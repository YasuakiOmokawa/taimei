import { validateProviderAuthResponse } from "./validateProviderAuthResponse";
import { setAuthResponseMessage } from "./setAuthResponseMessage";

type Props =
  | {
      type: "oauth";
      authType: string;
      profileEmail: string;
      providerAccountId: string;
      provider: string;
    }
  | {
      type: "email";
      email: string;
    };

export async function buildSignInResponse(
  props: Props
): Promise<boolean | string> {
  if (props.type === "oauth") {
    const res = await validateProviderAuthResponse(props);
    if (res !== true) {
      return res;
    }
    await setAuthResponseMessage(props);
    return true;
  } else if (props.type === "email") {
    await setAuthResponseMessage(props);
    return true;
  } else {
    return false;
  }
}
