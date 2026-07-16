import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewerContext, canManageOrg } from "@/lib/getViewerContext";
import CategoriesManager from "./CategoriesManager";

export default async function CategoriesPage() {
  const { profile, organization } = await requireViewerContext();
  if (!canManageOrg(profile)) redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: categories }, { data: rules }, { data: budgets }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, type, color, sort_order, is_archived")
      .eq("organization_id", organization.id)
      .order("sort_order"),
    supabase
      .from("category_rules")
      .select("id, keyword, category_id")
      .eq("organization_id", organization.id),
    supabase
      .from("budgets")
      .select("id, category_id, monthly_limit")
      .eq("organization_id", organization.id),
  ]);

  return (
    <CategoriesManager
      organizationId={organization.id}
      currency={organization.currency}
      initialCategories={categories ?? []}
      initialRules={rules ?? []}
      initialBudgets={budgets ?? []}
    />
  );
}
