import type { Metadata } from "next";
import { CustomerTable } from "../../../components/admin-customers/customer-table";

export const metadata: Metadata = {
  title: "Clientes",
};

export default function AdminCustomersPage() {
  return <CustomerTable />;
}
