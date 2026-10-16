// Mirrors docs/modules/repair/04-api-contract.md (shared objects + Stage 1–2 endpoints, CR-005).
// Field names are fixed by the contract — change only through a CR.

import type { Ref } from "@/lib/platform/types";

export type { Ref };

// ---- enums ----

export const TICKET_STATUSES = ["in_progress", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Progress shown to people (CR-005), derived by the server from status + assessment + send backs. */
export const TICKET_STEPS = ["awaiting_assessment", "in_repair", "reworking", "awaiting_rating", "closed"] as const;
export type TicketStep = (typeof TICKET_STEPS)[number];

export const CLOSED_REASONS = ["confirmed", "auto_closed", "team_handled", "admin_closed"] as const;
export type ClosedReason = (typeof CLOSED_REASONS)[number];

/** Most urgent first (BR-F21-1). */
export const PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Who did the work, recorded when the technician resolves the ticket. */
export type WorkBy = "in_house" | "contractor";

/** How the viewer relates to the ticket. `none` = admin / executive viewing. */
export type ViewerRelation = "reporter" | "subscriber" | "technician" | "none";

export type TicketAction = "assess" | "resolve" | "confirm" | "send_back" | "handover" | "close" | "change_priority";

export type BlockedReason = "ASSESSMENT_REQUIRED";

export type TimelineEventType =
  | "created"
  | "subscribed"
  | "assessed"
  | "assessment_changed"
  | "resolved"
  | "sent_back"
  | "confirmed"
  | "auto_closed"
  | "team_handled"
  | "handed_over"
  | "admin_closed"
  | "priority_changed";

// ---- shared objects ----

export type PersonRef = { id: string; name: string; department: string | null };

export type Photo = { id: string; thumbUrl: string; url: string };

/** Lists and cards. */
export type TicketSummary = {
  id: string;
  /** Display only — never rebuild it in the UI (BR-F02-5). */
  ticketNo: string;
  status: TicketStatus;
  step: TicketStep;
  closedReason: ClosedReason | null;
  priority: Priority;
  category: Ref;
  /** Title = symptom names joined with " · " (_common.md §3). */
  symptoms: Ref[];
  building: Ref;
  /** `floor.name` is the display name ("5"); render `{building} ชั้น {floor}`. */
  floor: Ref;
  locationDetail: string | null;
  thumbUrl: string | null;
  reporter: PersonRef;
  /** The technician who assessed / resolved it. */
  technician: PersonRef | null;
  viewerRelation: ViewerRelation;
  awaitingMyConfirmation: boolean;
  /** `YYYY-MM-DD` (Asia/Bangkok) once assessed. */
  expectedDoneOn: string | null;
  workBy: WorkBy | null;
  /** Staff only (technician / admin / executive); null for others. */
  contractor: Ref | null;
  /** Type names of the contractor — shown to everyone. */
  contractorTypes: string[];
  /** RFC 3339 UTC */
  autoCloseAt: string | null;
  sendBackCount: number;
  /** 1–5 from the reporter. */
  rating: number | null;
  createdAt: string;
  assessedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
};

export type TicketResult = {
  note: string;
  photos: Photo[];
  by: PersonRef | null;
  at: string | null;
  /** Staff only. */
  contractorRating: number | null;
  contractorRatingComment: string | null;
};

/** Type-specific fields of a timeline event. */
export type TimelineEventData = {
  rating?: number;
  expectedDoneOn?: string;
  workBy?: WorkBy;
  from?: Priority;
  to?: Priority;
};

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  actor: PersonRef | null;
  at: string;
  note: string | null;
  photos: Photo[];
  data: TimelineEventData;
};

export type BlockedActions = Partial<Record<"resolve", BlockedReason>>;

export type TicketDetail = TicketSummary & {
  details: string | null;
  photos: Photo[];
  asset: { code: string; name: string } | null;
  subscriberCount: number;
  result: TicketResult | null;
  ratingComment: string | null;
  /** Newest first. */
  timeline: TimelineEvent[];
  /** The server decides; the UI only renders these. */
  allowedActions: TicketAction[];
  blockedActions: BlockedActions;
};

// ---- #1 GET /repair/categories ----

export type Category = {
  id: string;
  name: string;
  /** lucide icon name (kebab-case); fall back to `wrench`. */
  icon: string;
  symptoms: Ref[];
};

// ---- #2 GET /repair/buildings ----

export type Floor = { id: string; name: string; level: number };

/** Floors ordered by `level`, bottom first. */
export type Building = { id: string; name: string; floors: Floor[] };

// ---- #5 POST /repair/tickets ----

export type CreateTicketRequest = {
  categoryId: string;
  symptomIds: string[];
  buildingId: string;
  floorId: string;
  locationDetail?: string;
  details?: string;
  priority: Priority;
  photoIds: string[];
  /** Filled from QR (Stage 5). */
  assetCode?: string;
  /** Team handled is Stage 4 (leads only); send null until then. */
  teamHandled: { note: string; photoIds: string[] } | null;
};

// ---- #6 GET /repair/tickets, #7 GET /repair/tickets/counts ----

export type TicketSort = "updatedAt:desc" | "createdAt:desc" | "createdAt:asc" | "closedAt:desc" | "priority:asc";

export type TicketListQuery = {
  /** `all`: technician, admin, executive. */
  scope?: "mine" | "all";
  status?: TicketStatus[];
  step?: TicketStep[];
  closedReason?: ClosedReason;
  /** Ticket number or location text. */
  q?: string;
  /** RFC 3339 */
  createdFrom?: string;
  createdTo?: string;
  /** Mine only. */
  relation?: "all" | "reported" | "following";
  categoryId?: string;
  buildingId?: string;
  floorId?: string;
  priority?: Priority;
  page?: number;
  pageSize?: number;
  /** Default: closed → closedAt:desc, otherwise latest update first; awaiting my rating first (BR-F06-2). */
  sort?: TicketSort;
};

export type TicketCountsQuery = Omit<TicketListQuery, "status" | "step" | "page" | "pageSize" | "sort">;

export type TicketPage = {
  items: TicketSummary[];
  meta: { page: number; pageSize: number; total: number };
};

export type TicketCounts = {
  inProgress: number;
  resolved: number;
  closed: number;
  /** inProgress split: not assessed yet / assessed (incl. reworking). */
  awaitingAssessment: number;
  inRepair: number;
  awaitingMyConfirmation: number;
};

// ---- #9–#12 ticket actions ----

/** The assessment (CR-006): expected finish date + who does the work. */
export type AssessRequest = { expectedDoneOn: string; workBy: WorkBy; contractorId?: string };

/** `contractorRating` is required for a contractor job that has no rating yet. */
export type ResolveRequest = {
  note: string;
  photoIds: string[];
  contractorRating?: number;
  contractorRatingComment?: string;
};

export type ConfirmRequest = { rating: number; comment?: string };

export type SendBackRequest = { reason: string; photoIds: string[] };

// ---- #13–#19 contractors (F24) ----

export type Contractor = {
  id: string;
  name: string;
  types: Ref[];
  contactName: string | null;
  phone: string | null;
  note: string | null;
  isActive: boolean;
  jobCount: number;
  ratedCount: number;
  /** null until the contractor has a rating. */
  avgRating: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ContractorRequest = {
  name: string;
  typeIds: string[];
  contactName?: string;
  phone?: string;
  note?: string;
  /** Update only. */
  isActive?: boolean;
};

export type ContractorQuery = { q?: string; typeId?: string; includeInactive?: boolean; page?: number; pageSize?: number };

export type ContractorPage = { items: Contractor[]; meta: { page: number; pageSize: number; total: number } };

export type ContractorJob = {
  ticketId: string;
  ticketNo: string;
  status: TicketStatus;
  category: Ref;
  resolvedAt: string | null;
  contractorRating: number | null;
  contractorRatingComment: string | null;
  reporterRating: number | null;
};

export type ContractorJobPage = { items: ContractorJob[]; meta: { page: number; pageSize: number; total: number } };

// ---- errors (04-api-contract.md "Error codes") ----

export type RepairErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_FAILED"
  | "FORBIDDEN"
  | "TICKET_NOT_FOUND"
  | "PHOTO_NOT_FOUND"
  | "PHOTO_TYPE_NOT_ALLOWED"
  | "PHOTO_TOO_LARGE"
  | "MASTER_DATA_CHANGED"
  | "TEAM_HANDLED_NOT_ALLOWED"
  | "NOT_TECHNICIAN"
  | "NOT_REPORTER"
  | "TICKET_CLOSED"
  | "INVALID_STATE"
  | "ASSESSMENT_REQUIRED"
  | "CONTRACTOR_NOT_FOUND"
  | "CONTRACTOR_TYPE_NOT_FOUND"
  | "ALREADY_FOLLOWING"
  | "NOT_TEAM_HANDLED"
  | "ASSET_NOT_FOUND"
  | "NETWORK";

/** Field codes in `VALIDATION_FAILED.fields`. */
export type FieldCode = "REQUIRED" | "TOO_LONG" | "MIN_ITEMS" | "MAX_ITEMS" | "INVALID" | "PAST";
