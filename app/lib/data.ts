import { sql } from "@vercel/postgres";
import { CustomersTableType } from "./definitions";
import { formatCurrency } from "./utils";
import { Prisma } from "@prisma/client";
import { Invoices } from "@/app/models/invoices";
import { prisma } from "@/prisma";
import { auth } from "@/auth";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { id, name, email, image } = (await auth())?.user ?? {};
  return {
    id: id ?? "",
    name: name ?? "",
    email: email ?? "",
    image: image ?? "",
  };
}

export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in productions

    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await prisma.revenue.findMany({
      select: {
        month: true,
        revenue: true,
      },
    });

    // console.log('Data fetch completed after 3 seconds.');

    return data;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

const fetchLatestInvoicesQuery =
  Prisma.validator<Prisma.invoicesFindManyArgs>()({
    select: {
      amount: true,
      id: true,
      customer: {
        select: {
          name: true,
          image_url: true,
          email: true,
        },
      },
    },
    orderBy: {
      date: "asc",
    },
    take: 5,
  });

export type LatestInvoice = Omit<
  Prisma.invoicesGetPayload<typeof fetchLatestInvoicesQuery>,
  "amount"
> & { amount: string };

export async function fetchLatestInvoices() {
  try {
    const data = await prisma.invoices.findMany(fetchLatestInvoicesQuery);

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

const userProfileSelectionById = {
  bio: true,
} satisfies Prisma.UserProfileSelect;

export type UserProfileSelectionById = Prisma.UserProfileGetPayload<{
  select: typeof userProfileSelectionById;
}>;

export async function fetchUserProfile(userId: string) {
  try {
    const data = await prisma.userProfile.findUnique({
      select: userProfileSelectionById,
      where: {
        userId: userId,
      },
    });
    return data;
  } catch (e) {
    throw new Error("failed to fetch UserProfile.", { cause: e });
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = prisma.invoices.count();
    const customerCountPromise = prisma.customers.count();
    const invoiceStatusPromise = prisma.$queryRaw<
      {
        paid: number;
        pending: number;
      }[]
    >`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = data[0];
    const numberOfCustomers = data[1];
    const totalPaidInvoices = formatCurrency(Number(data[2][0].paid));
    const totalPendingInvoices = formatCurrency(Number(data[2][0].pending));

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  try {
    const invoices = await Invoices(prisma.invoices).filteredFetch({
      query: query,
      currentPage: currentPage,
    });

    return invoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const totalPages = await Invoices(prisma.invoices).fetchTotaltPages({
      query: query,
    });

    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

const invoiceSelectionById = {
  id: true,
  customer_id: true,
  amount: true,
  status: true,
} satisfies Prisma.invoicesSelect;

export type InvoiceSelectionById = Omit<
  Prisma.invoicesGetPayload<{
    select: typeof invoiceSelectionById;
  }>,
  "status"
> & { status: "pending" | "paid" };

export async function fetchInvoiceById(id: string) {
  try {
    const invoice = await prisma.invoices.findUnique({
      select: invoiceSelectionById,
      where: {
        id: id,
      },
    });

    if (!invoice) return invoice;

    return {
      ...invoice,
      // convert dollar from sent
      amount: invoice.amount / 100,
    } as InvoiceSelectionById;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

const fetchCustomersQuery = Prisma.validator<Prisma.customersFindManyArgs>()({
  select: {
    id: true,
    name: true,
  },
  orderBy: {
    name: "asc",
  },
});

export type CustomerField = Prisma.customersGetPayload<
  typeof fetchCustomersQuery
>;

export async function fetchCustomers() {
  try {
    const customers = await prisma.customers.findMany(fetchCustomersQuery);

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
