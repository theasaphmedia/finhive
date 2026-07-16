// Starter category templates offered at organization signup (Build Spec, Section 3 & 7).
// These are only a *starting point* -- every category here is fully editable, renameable,
// archivable, and reorderable after signup, and orgs can skip templates entirely and
// start blank. Nothing about categorization logic is hardcoded to any one of these lists.

export type CategoryType = "income" | "expense";

export interface StarterCategory {
  name: string;
  type: CategoryType;
  color?: string;
}

export interface CategoryTemplate {
  id: string;
  label: string;
  description: string;
  categories: StarterCategory[];
}

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    id: "generic",
    label: "Generic starter set",
    description: "A sensible default usable by almost any organization.",
    categories: [
      { name: "Income", type: "income" },
      { name: "Salaries/Wages", type: "expense" },
      { name: "Rent/Utilities", type: "expense" },
      { name: "Supplies", type: "expense" },
      { name: "Transport", type: "expense" },
      { name: "Maintenance", type: "expense" },
      { name: "Bank Charges", type: "expense" },
      { name: "Miscellaneous", type: "expense" },
    ],
  },
  {
    id: "creative-studio",
    label: "Creative studio",
    description:
      "Proven through the TWN Studios pilot -- good fit for studios, production houses, and event-based creative businesses.",
    categories: [
      { name: "Diesel (Studio)", type: "expense" },
      { name: "Fuel (Vehicles)", type: "expense" },
      { name: "Staff Gifts", type: "expense" },
      { name: "Snacks", type: "expense" },
      { name: "Clothes", type: "expense" },
      { name: "Logistics/Delivery", type: "expense" },
      { name: "Vehicle Maintenance", type: "expense" },
      { name: "Transport", type: "expense" },
      { name: "Medical/Drugs", type: "expense" },
      { name: "Airtime/Data", type: "expense" },
      { name: "Bank Charges", type: "expense" },
    ],
  },
  {
    id: "church-ministry",
    label: "Church / ministry",
    description: "For churches, ministries, and faith-based organizations.",
    categories: [
      { name: "Tithes & Offerings", type: "income" },
      { name: "Missions/Outreach", type: "expense" },
      { name: "Building/Facility Maintenance", type: "expense" },
      { name: "Utilities", type: "expense" },
      { name: "Salaries/Stipends", type: "expense" },
      { name: "Events & Programs", type: "expense" },
      { name: "Benevolence/Welfare", type: "expense" },
      { name: "Transport", type: "expense" },
      { name: "Bank Charges", type: "expense" },
      { name: "Miscellaneous", type: "expense" },
    ],
  },
  {
    id: "small-business",
    label: "General small business",
    description: "A broad-purpose set for shops, agencies, and general small businesses.",
    categories: [
      { name: "Sales/Revenue", type: "income" },
      { name: "Salaries/Wages", type: "expense" },
      { name: "Rent/Utilities", type: "expense" },
      { name: "Supplies/Inventory", type: "expense" },
      { name: "Marketing", type: "expense" },
      { name: "Transport", type: "expense" },
      { name: "Equipment Maintenance", type: "expense" },
      { name: "Professional Services", type: "expense" },
      { name: "Bank Charges", type: "expense" },
      { name: "Miscellaneous", type: "expense" },
    ],
  },
];

export const BLANK_TEMPLATE_ID = "blank";
