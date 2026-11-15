import { Array, Option, Schema } from "effect";
import { AsyncData, Submodel, Update } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { modifyFields } from "foldkit/struct";
import { ChevronLeft } from "lucide";
import type { SpaHttpClient } from "../../shared/spa-http-client";
import { Submission } from "../../shared/submission";
import { rejectionAlertView } from "../../shared/ui/alert-text-view";
import { buttonView } from "../../shared/ui/button-view";
import {
  cardLoadingView,
  cardMessageView,
  cardView,
} from "../../shared/ui/card-view";
import { iconView } from "../../shared/ui/icon-view";
import { inputView } from "../../shared/ui/input-view";
import { selectView } from "../../shared/ui/select-view";
import * as Mutation from "../mutation";
import * as MyLevelsForm from "../my-levels-form";
import { sectionView } from "../section-view";
import {
  type Member,
  type Roster,
  type TeamDetail,
  teamSkillMatrix,
} from "../skill-matrix";
import {
  MESSAGE_WITHOUT_MATRIX,
  skillMatrixSectionView,
} from "../skill-matrix-view";
import { submitFormView } from "../submit-form-view";

const SUBMISSION_SLOTS = [
  "renaming",
  "deleting",
  "addingSkill",
  "removingSkill",
  "assigning",
  "unassigning",
] as const;

const SubmissionSlot = Schema.Literals(SUBMISSION_SLOTS);
type SubmissionSlot = typeof SubmissionSlot.Type;

const RenameDraft = Schema.Struct({
  value: Schema.String,
  editedFrom: Schema.String,
});

export const Model = Schema.Struct({
  myLevelsForm: MyLevelsForm.Model,
  maybeRenameDraft: Schema.Option(RenameDraft),
  skillNameDraft: Schema.String,
  maybeAssigneeDraft: Schema.Option(Schema.String),
  renaming: Mutation.Model,
  deleting: Mutation.Model,
  addingSkill: Mutation.Model,
  removingSkill: Mutation.Model,
  assigning: Mutation.Model,
  unassigning: Mutation.Model,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  GotMyLevelsFormMessage: { message: MyLevelsForm.Message },
  UpdatedTeamName: RenameDraft.fields,
  UpdatedSkillName: { value: Schema.String },
  SelectedAssignee: { userId: Schema.String },
  SubmittedRenameForm: { teamId: Schema.String, teamName: Schema.String },
  SubmittedAddSkillForm: { teamId: Schema.String },
  SubmittedAssignForm: {
    teamId: Schema.String,
    candidateUserIds: Schema.NonEmptyArray(Schema.String),
  },
  SubmittedWhileRefreshing: {},
  ClickedRemoveSkill: Mutation.RemoveSkillArgs,
  ClickedUnassign: Mutation.UnassignMemberArgs,
  ClickedDeleteTeam: Mutation.DeleteTeamArgs,
  GotMutationMessage: { slotId: SubmissionSlot, message: Mutation.Message },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  FinishedMutation: { outcome: Mutation.OutMessage },
});
export type OutMessage = typeof OutMessage.Type;

type LoadedTeam = Readonly<{
  team: TeamDetail;
  members: ReadonlyArray<Member> | null;
}>;

type ViewInputs = Readonly<{
  teamId: string;
  myUserId: string;
  canManage: boolean;
  team: AsyncData.AsyncData<LoadedTeam, string>;
  teamsHref: string;
}>;

type KnownRoster = Exclude<Roster, { _tag: "MembersUnavailable" }>;

export const init = (): Model => ({
  myLevelsForm: MyLevelsForm.init(),
  maybeRenameDraft: Option.none(),
  skillNameDraft: "",
  maybeAssigneeDraft: Option.none(),
  renaming: Mutation.init(),
  deleting: Mutation.init(),
  addingSkill: Mutation.init(),
  removingSkill: Mutation.init(),
  assigning: Mutation.init(),
  unassigning: Mutation.init(),
});

export const isSubmitting = (model: Model) =>
  MyLevelsForm.isSaving(model.myLevelsForm) ||
  Array.some(SUBMISSION_SLOTS, (slotId) =>
    Submission.guards.Submitting(model[slotId]),
  );

type Step = Update.Step<Model, Message>;

const unchanged: Step = (model) => ({ model });

const mutationChild = (slotId: SubmissionSlot) => ({
  read: (model: Model) => Option.some(model[slotId]),
  write: (model: Model, nextSubmission: Mutation.Model): Model => ({
    ...model,
    [slotId]: nextSubmission,
  }),
  toParentMessage: (message: Mutation.Message) =>
    Message.GotMutationMessage({ slotId, message }),
});

const foldSubmit = <Args>(
  slotId: SubmissionSlot,
  submit: (
    submission: Mutation.Model,
    args: Args,
  ) => Update.Return<Mutation.Model, Mutation.Message, SpaHttpClient>,
) => Update.foldChild({ ...mutationChild(slotId), update: submit });

const clearSkillNameDraft: Step = (model) => ({
  model: modifyFields(model, { skillNameDraft: () => "" }),
});

const clearAssigneeDraft: Step = (model) => ({
  model: modifyFields(model, { maybeAssigneeDraft: () => Option.none() }),
});

const AFTER_SUCCESS: Record<SubmissionSlot, Step> = {
  renaming: unchanged,
  deleting: unchanged,
  addingSkill: clearSkillNameDraft,
  removingSkill: unchanged,
  assigning: clearAssigneeDraft,
  unassigning: unchanged,
};

const foldSettled = (slotId: SubmissionSlot) =>
  Update.foldChild({
    ...mutationChild(slotId),
    update: Mutation.update,
    toParentOutMessage: (outcome: Mutation.OutMessage) =>
      OutMessage.FinishedMutation({ outcome }),
    foldOutMessage: Mutation.OutMessage.match<Step>({
      SucceededMutation: () => AFTER_SUCCESS[slotId],
      RequiredSignIn: () => unchanged,
      ChangedSession: () => unchanged,
    }),
  });

const foldMyLevelsForm = Update.foldChild({
  update: MyLevelsForm.update,
  read: (model: Model) => Option.some(model.myLevelsForm),
  write: (model: Model, nextMyLevelsForm: MyLevelsForm.Model) =>
    modifyFields(model, { myLevelsForm: () => nextMyLevelsForm }),
  toParentMessage: (message: MyLevelsForm.Message) =>
    Message.GotMyLevelsFormMessage({ message }),
  toParentOutMessage: ({ outcome }: MyLevelsForm.OutMessage) =>
    OutMessage.FinishedMutation({ outcome }),
  foldOutMessage: MyLevelsForm.OutMessage.match<Step>({
    FinishedMutation: () => unchanged,
  }),
});

const shownTeamNameOf = (model: Model, teamName: string) =>
  model.maybeRenameDraft.pipe(
    Option.filter(({ editedFrom }) => editedFrom === teamName),
    Option.match({
      onNone: () => teamName,
      onSome: ({ value }) => value,
    }),
  );

const assigneeOf = (
  model: Model,
  candidateUserIds: Array.NonEmptyReadonlyArray<string>,
) =>
  model.maybeAssigneeDraft.pipe(
    Option.filter((userId) => Array.contains(candidateUserIds, userId)),
    Option.getOrElse(() => Array.headNonEmpty(candidateUserIds)),
  );

export const update = (model: Model, message: Message) =>
  Message.match<
    Update.ReturnWithOutMessage<Model, Message, OutMessage, SpaHttpClient>
  >(message, {
    GotMyLevelsFormMessage: ({ message: myLevelsFormMessage }) =>
      foldMyLevelsForm(model, myLevelsFormMessage),
    UpdatedTeamName: ({ value, editedFrom }) => ({
      model: modifyFields(model, {
        maybeRenameDraft: () => Option.some({ value, editedFrom }),
      }),
    }),
    UpdatedSkillName: ({ value }) => ({
      model: modifyFields(model, { skillNameDraft: () => value }),
    }),
    SelectedAssignee: ({ userId }) => ({
      model: modifyFields(model, {
        maybeAssigneeDraft: () => Option.some(userId),
      }),
    }),
    SubmittedRenameForm: ({ teamId, teamName }) =>
      foldSubmit("renaming", Mutation.submitRenameTeam)(model, {
        teamId,
        name: shownTeamNameOf(model, teamName),
      }),
    SubmittedAddSkillForm: ({ teamId }) =>
      foldSubmit("addingSkill", Mutation.submitAddSkill)(model, {
        teamId,
        name: model.skillNameDraft,
      }),
    SubmittedAssignForm: ({ teamId, candidateUserIds }) =>
      foldSubmit("assigning", Mutation.submitAssignMember)(model, {
        teamId,
        userId: assigneeOf(model, candidateUserIds),
      }),
    SubmittedWhileRefreshing: () => ({ model }),
    ClickedRemoveSkill: ({ teamId, skillId, confirmation }) =>
      foldSubmit("removingSkill", Mutation.submitRemoveSkill)(model, {
        teamId,
        skillId,
        confirmation,
      }),
    ClickedUnassign: ({ teamId, userId, confirmation }) =>
      foldSubmit("unassigning", Mutation.submitUnassignMember)(model, {
        teamId,
        userId,
        confirmation,
      }),
    ClickedDeleteTeam: ({ teamId, confirmation }) =>
      foldSubmit("deleting", Mutation.submitDeleteTeam)(model, {
        teamId,
        confirmation,
      }),
    GotMutationMessage: ({ slotId, message: mutationMessage }) =>
      foldSettled(slotId)(model, mutationMessage),
  });

type NamedItem = Readonly<{
  key: string;
  name: string;
  actions: ReadonlyArray<Html>;
}>;

const namedItemsView = (
  items: ReadonlyArray<NamedItem>,
  h: HtmlBuilder<Message>,
): Html =>
  h.ul(
    [h.Class("divide-y border-t")],
    Array.map(items, ({ key, name, actions }) =>
      h.keyed("li")(
        key,
        [
          h.Class(
            "flex min-h-12 items-center justify-between gap-4 px-6 py-3 text-sm",
          ),
        ],
        [h.span([h.Class("min-w-0 break-words")], [name]), ...actions],
      ),
    ),
  );

const namedItemsOrMessageView = (
  items: ReadonlyArray<NamedItem>,
  emptyMessage: string,
  h: HtmlBuilder<Message>,
): Html =>
  Array.match(items, {
    onEmpty: () => cardMessageView(emptyMessage, h),
    onNonEmpty: (nonEmptyItems) => namedItemsView(nonEmptyItems, h),
  });

const destructiveButtonView = (
  config: Readonly<{
    label: string;
    accessibleName?: string;
    submission: Mutation.Model;
    isBlocked: boolean;
    onClick: Message;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  buttonView({ look: "destructiveOutlineSmall", type: "button", ...config }, h);

const managementFooterView = (
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
) => h.div([h.Class("space-y-2 border-t px-6 py-4")], children);

type Management = Readonly<{
  teamId: string;
  isBlocked: boolean;
}>;

const submitUnlessBlocked = (isBlocked: boolean, submitted: Message) =>
  isBlocked ? Message.SubmittedWhileRefreshing() : submitted;

const removeSkillConfirmation = (skillName: string) =>
  `スキル「${skillName}」を削除します。このスキルに記入したレベルも消え、元に戻せません。`;

const unassignConfirmation = (name: string) =>
  `${name} をこのチームから外します。このチームに記入したレベルも消え、元に戻せません。`;

const deleteTeamConfirmation = (teamName: string) =>
  `「${teamName}」を削除します。スキル・割り当て・記入したレベルも消え、元に戻せません。`;

const skillFooterView = (
  model: Model,
  { teamId, isBlocked }: Management,
  h: HtmlBuilder<Message>,
): Html =>
  managementFooterView(
    [
      ...rejectionAlertView(model.removingSkill, h),
      submitFormView(
        {
          control: inputView(
            {
              id: "add-skill-name",
              label: "スキル名",
              value: model.skillNameDraft,
              onInput: (value) => Message.UpdatedSkillName({ value }),
            },
            h,
          ),
          submitLabel: "スキルを足す",
          submission: model.addingSkill,
          isBlocked,
          onSubmit: submitUnlessBlocked(
            isBlocked,
            Message.SubmittedAddSkillForm({ teamId }),
          ),
        },
        h,
      ),
    ],
    h,
  );

const skillsSectionView = (
  model: Model,
  skills: TeamDetail["skills"],
  maybeManagement: Option.Option<Management>,
  h: HtmlBuilder<Message>,
): Html =>
  sectionView(
    { title: "スキル", description: "星取表の列になります" },
    [
      namedItemsOrMessageView(
        Array.map(skills, (skill) => ({
          key: skill.id,
          name: skill.name,
          actions: Array.fromOption(
            Option.map(maybeManagement, ({ teamId, isBlocked }) =>
              destructiveButtonView(
                {
                  label: "削除",
                  accessibleName: `${skill.name} を削除`,
                  submission: model.removingSkill,
                  isBlocked,
                  onClick: Message.ClickedRemoveSkill({
                    teamId,
                    skillId: skill.id,
                    confirmation: removeSkillConfirmation(skill.name),
                  }),
                },
                h,
              ),
            ),
          ),
        })),
        "スキルがありません",
        h,
      ),
      ...Array.fromOption(
        Option.map(maybeManagement, (management) =>
          skillFooterView(model, management, h),
        ),
      ),
    ],
    h,
  );

const assignFormView = (
  model: Model,
  candidates: Array.NonEmptyReadonlyArray<Member>,
  { teamId, isBlocked }: Management,
  h: HtmlBuilder<Message>,
): Html => {
  const candidateUserIds = Array.map(candidates, ({ userId }) => userId);
  const assignee = assigneeOf(model, candidateUserIds);
  return submitFormView(
    {
      control: selectView(
        {
          id: "assignee",
          label: "割り当てるメンバー",
          value: assignee,
          options: Array.map(candidates, ({ userId, name }) => ({
            value: userId,
            label: name,
          })),
          onChange: (userId) => Message.SelectedAssignee({ userId }),
          look: "field",
        },
        h,
      ),
      submitLabel: "割り当てる",
      submission: model.assigning,
      isBlocked,
      onSubmit: submitUnlessBlocked(
        isBlocked,
        Message.SubmittedAssignForm({ teamId, candidateUserIds }),
      ),
    },
    h,
  );
};

const assignedItemOf = (
  model: Model,
  userId: string,
  name: string,
  maybeManagement: Option.Option<Management>,
  h: HtmlBuilder<Message>,
): NamedItem => ({
  key: userId,
  name,
  actions: Array.fromOption(
    Option.map(maybeManagement, ({ teamId, isBlocked }) =>
      destructiveButtonView(
        {
          label: "外す",
          accessibleName: `${name} を外す`,
          submission: model.unassigning,
          isBlocked,
          onClick: Message.ClickedUnassign({
            teamId,
            userId,
            confirmation: unassignConfirmation(name),
          }),
        },
        h,
      ),
    ),
  ),
});

const departedAssignmentsView = (
  model: Model,
  departedUserIds: ReadonlyArray<string>,
  management: Management,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Array.match(departedUserIds, {
    onEmpty: () => [],
    onNonEmpty: (userIds) => [
      h.h3(
        [h.Class("border-t px-6 pt-4 pb-2 text-sm font-medium")],
        ["事業所にいない人の割り当て"],
      ),
      namedItemsView(
        Array.map(userIds, (userId) =>
          assignedItemOf(model, userId, userId, Option.some(management), h),
        ),
        h,
      ),
    ],
  });

const assignmentFooterView = (
  model: Model,
  candidates: ReadonlyArray<Member>,
  management: Management,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const footer = [
    ...rejectionAlertView(model.unassigning, h),
    ...Array.match(candidates, {
      onEmpty: () => [],
      onNonEmpty: (nonEmptyCandidates) => [
        assignFormView(model, nonEmptyCandidates, management, h),
      ],
    }),
  ];
  return Array.match(footer, {
    onEmpty: () => [],
    onNonEmpty: (children) => [managementFooterView(children, h)],
  });
};

const knownAssignmentsView = (
  model: Model,
  roster: KnownRoster,
  maybeManagement: Option.Option<Management>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  namedItemsOrMessageView(
    Array.map(roster.assigned, ({ userId, name }) =>
      assignedItemOf(model, userId, name, maybeManagement, h),
    ),
    "割り当てたメンバーがいません",
    h,
  ),
  ...Option.match(maybeManagement, {
    onNone: () => [],
    onSome: (management) => [
      ...departedAssignmentsView(model, roster.departedUserIds, management, h),
      ...assignmentFooterView(model, roster.candidates, management, h),
    ],
  }),
];

const assignmentsSectionView = (
  model: Model,
  roster: Roster,
  maybeManagement: Option.Option<Management>,
  h: HtmlBuilder<Message>,
): Html =>
  sectionView(
    { title: "割り当てたメンバー", description: "星取表の行になります" },
    roster._tag === "MembersUnavailable"
      ? [cardMessageView(MESSAGE_WITHOUT_MATRIX.MembersUnavailable, h)]
      : knownAssignmentsView(model, roster, maybeManagement, h),
    h,
  );

const teamDeletionView = (
  model: Model,
  teamName: string,
  { teamId, isBlocked }: Management,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Class(
        "flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4",
      ),
    ],
    [
      h.p(
        [h.Class("text-sm text-muted-foreground")],
        ["チームを削除すると、スキル・割り当て・記入したレベルも消えます"],
      ),
      h.div(
        [h.Class("flex flex-wrap items-center gap-x-4 gap-y-2")],
        [
          ...rejectionAlertView(model.deleting, h),
          destructiveButtonView(
            {
              label: "チームを削除",
              submission: model.deleting,
              isBlocked,
              onClick: Message.ClickedDeleteTeam({
                teamId,
                confirmation: deleteTeamConfirmation(teamName),
              }),
            },
            h,
          ),
        ],
      ),
    ],
  );

const teamNameSectionView = (
  model: Model,
  teamName: string,
  management: Management,
  h: HtmlBuilder<Message>,
): Html => {
  const { teamId, isBlocked } = management;
  const shownTeamName = shownTeamNameOf(model, teamName);
  return sectionView(
    { title: "チーム名" },
    [
      h.div(
        [h.Class("px-6 pb-6")],
        [
          submitFormView(
            {
              control: inputView(
                {
                  id: "rename-team-name",
                  label: "チーム名",
                  value: shownTeamName,
                  onInput: (value) =>
                    Message.UpdatedTeamName({ value, editedFrom: teamName }),
                },
                h,
              ),
              submitLabel: "名前を変える",
              submission: model.renaming,
              isBlocked,
              onSubmit: submitUnlessBlocked(
                isBlocked,
                Message.SubmittedRenameForm({ teamId, teamName }),
              ),
            },
            h,
          ),
        ],
      ),
      teamDeletionView(model, teamName, management, h),
    ],
    h,
  );
};

const teamFrameView = (
  teamsHref: string,
  maybeTitle: Option.Option<string>,
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("space-y-6")],
    [
      h.div(
        [h.Class("space-y-2")],
        [
          h.a(
            [
              h.Href(teamsHref),
              h.Class(
                "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground",
              ),
            ],
            [iconView(ChevronLeft, [h.Class("size-4")], h), "チーム"],
          ),
          ...Option.match(maybeTitle, {
            onNone: () => [],
            onSome: (title) => [
              h.h1([h.Class("text-2xl font-semibold")], [title]),
            ],
          }),
        ],
      ),
      ...children,
    ],
  );

const loadedTeamView = (
  model: Model,
  loaded: LoadedTeam,
  viewInputs: ViewInputs,
  h: HtmlBuilder<Message>,
): Html => {
  const team = MyLevelsForm.teamWithPendingLevels(
    model.myLevelsForm,
    loaded.team,
    viewInputs.myUserId,
  );
  const { myCells, roster } = teamSkillMatrix(
    team,
    loaded.members,
    viewInputs.myUserId,
  );
  const maybeManagement = viewInputs.canManage
    ? Option.some({
        teamId: viewInputs.teamId,
        isBlocked: AsyncData.isPending(viewInputs.team),
      })
    : Option.none();
  return teamFrameView(
    viewInputs.teamsHref,
    Option.some(team.name),
    [
      skillMatrixSectionView(roster, h),
      ...Array.match(myCells, {
        onEmpty: () => [],
        onNonEmpty: (cells) => [
          h.submodel({
            slotId: "my-levels-form",
            view: MyLevelsForm.view,
            model: model.myLevelsForm,
            viewInputs: {
              teamId: viewInputs.teamId,
              myUserId: viewInputs.myUserId,
              myCells: cells,
            },
            toParentMessage: (message) =>
              Message.GotMyLevelsFormMessage({ message }),
          }),
        ],
      }),
      h.keyed("div")(
        "skills-and-assignments",
        [h.Class("grid items-start gap-6 lg:grid-cols-2")],
        [
          skillsSectionView(model, team.skills, maybeManagement, h),
          assignmentsSectionView(model, roster, maybeManagement, h),
        ],
      ),
      ...Array.fromOption(
        Option.map(maybeManagement, (management) =>
          teamNameSectionView(model, team.name, management, h),
        ),
      ),
    ],
    h,
  );
};

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, viewInputs, h) => {
    const untitledCardView = (content: Html) =>
      teamFrameView(
        viewInputs.teamsHref,
        Option.none(),
        [cardView([content], h)],
        h,
      );
    return AsyncData.matchData(viewInputs.team, {
      onEmpty: () => untitledCardView(cardLoadingView(h)),
      onFailure: (failureMessage) =>
        untitledCardView(cardMessageView(failureMessage, h)),
      onData: (loaded) => loadedTeamView(model, loaded, viewInputs, h),
    });
  },
);
