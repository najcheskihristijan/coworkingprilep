// Single source of truth for sellable plans.
// Used by /pricing and /checkout.
//
// ⚠️ MKD amounts are what actually get charged through the ProCredit gateway.
// EUR figures are display only. Confirm every `mkd` value with accounting
// before enabling live payments.

export type Plan = {
  slug: string;
  name: string;
  eur: number;
  mkd: number;
  period: string;
  blurb: string;
  perks: string[];
  group: "credits" | "monthly";
  featured?: boolean;
  note?: string;
  /** false = enquiry only, no online checkout */
  purchasable: boolean;
};

export const plans: Plan[] = [
  {
    slug: "starter-8",
    name: "Starter 8",
    eur: 8,
    mkd: 500,
    period: "/ 8 hours",
    blurb: "8 hours, use within 1 week. The lightest commitment.",
    perks: [
      "8 hours of access",
      "Valid for 7 days",
      "Any open hot desk",
      "Full amenities",
    ],
    group: "credits",
    purchasable: true,
  },
  {
    slug: "flex-10",
    name: "Flex 10",
    eur: 50,
    mkd: 3075,
    period: "/ 80 hours",
    blurb: "80 hours (~10 work-days), use within 2 months.",
    perks: [
      "80 hours of access",
      "Valid for 60 days",
      "Any open hot desk",
      "~€0.63 / hour",
    ],
    group: "credits",
    purchasable: true,
  },
  {
    slug: "student-pass",
    name: "Student Pass",
    eur: 24,
    mkd: 1500,
    period: "/ month",
    blurb: "Faculty partnership pricing. Valid student ID required.",
    perks: [
      "Hot desk access, weekdays 9–5",
      "Wi-Fi + coffee + kitchen",
      "Community events",
    ],
    group: "monthly",
    note: "Pending faculty deal",
    purchasable: false,
  },
  {
    slug: "hot-desk",
    name: "Hot Desk",
    eur: 80,
    mkd: 4920,
    period: "/ month",
    blurb: "Drop-in any day, 20% gym membership discount.",
    perks: [
      "160 hours / month",
      "24/7 keycard access",
      "20% gym membership discount",
      "Wi-Fi, coffee, kitchen",
    ],
    group: "monthly",
    featured: true,
    purchasable: true,
  },
  {
    slug: "dedicated-desk",
    name: "Dedicated Desk",
    eur: 110,
    mkd: 6765,
    period: "/ month",
    blurb: "Your own desk, 20% gym discount, upper quiet floor.",
    perks: [
      "Unlimited hours",
      "Your own permanent desk",
      "20% gym membership discount",
      "Monitor stand provided",
      "Upper floor, quiet zone",
    ],
    group: "monthly",
    purchasable: true,
  },
  {
    slug: "team",
    name: "Team Package",
    eur: 60,
    mkd: 3690,
    period: "/ seat / month",
    blurb: "Groups of 3+, company invoice, bulk discount.",
    perks: [
      "Minimum 3 seats",
      "Hot desk access each",
      "20% gym discount per seat",
      "24/7 access, company invoice",
    ],
    group: "monthly",
    purchasable: false,
  },
];

export const rooms = [
  {
    name: "Meeting room",
    blurb: "Open to non-members. Members pay the same hourly rate.",
    rows: [
      ["1 hour", "€16", "1,000 MKD"],
      ["4-hour block", "€49", "3,000 MKD"],
      ["8-hour block", "€81", "5,000 MKD"],
    ],
  },
  {
    name: "Classroom",
    blurb:
      "Workshops, training sessions, talks. First hour €15, every hour after that drops to €13, per hour, for continuous bookings.",
    rows: [
      ["First hour", "€15 / hr", "900 MKD"],
      ["Each hour after", "€13 / hr", "800 MKD"],
    ],
  },
];

export const getPlan = (slug: string) => plans.find((p) => p.slug === slug);
