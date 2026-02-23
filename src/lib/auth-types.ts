export type AuthUserStatus = "active" | "suspended" | "disabled";
export type DeleteRequestStatus = "pending" | "approved" | "rejected";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  address: string;
  country: string;
  state: string;
  plan: "free" | "pro";
  proInterest: boolean;
  isAdmin: boolean;
  status: AuthUserStatus;
  createdAt: string;
};

export type UserNotification = {
  id: string;
  title: string;
  message: string;
  isBroadcast: boolean;
  createdAt: string;
};

export type UserUsage = {
  usageCount: number;
  copyClicks: number;
  postClicks: number;
  globalFreeLimit: number;
  limitOverride: number | null;
  freeLimit: number;
  freeRemaining: number;
};

export type AccountDeleteRequest = {
  id: string;
  userId: string;
  userEmail: string;
  reason: string;
  status: DeleteRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
};
