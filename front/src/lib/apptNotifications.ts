/**
 * Shared helpers for keeping "Appointment Reminder" notifications in sync
 * with their underlying appointment row, for **every user role** that should
 * see the reminder (doctor, parent, admin/service, super_admin/supervisor,
 * receptionist of the same service).
 *
 * An appointment-linked notification is any row in `notifications` whose
 * `message` field contains either:
 *   - the canonical tag `[APT:<aptId>]` (new style), or
 *   - the legacy tag `(ID: <aptId>)`, or
 *   - a raw occurrence of `<aptId>` (defensive fallback).
 *
 * These helpers are used on appointment create/edit/delete so the reminder
 * always reflects the latest date/time/patient/doctor, and so deleted or
 * cancelled / completed appointments don't leave stale reminders behind.
 */

import { crudApi } from "@/lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Only create reminder notifications for appointments starting within this
 *  window from now. Past / cancelled / far-future appointments get no new
 *  notification (old ones are still deleted so nothing stale remains). */
export const APT_NOTIF_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

// ---------------------------------------------------------------------------
// Message builder
// ---------------------------------------------------------------------------

export const buildAptNotifMessage = (params: {
  aptId: string;
  dateISO: string;
  patientName: string;
  doctorName: string;
  lang: "ar" | "fr" | string;
  locale: string;
}): string => {
  const { aptId, dateISO, patientName, doctorName, lang, locale } = params;
  const d = new Date(dateISO);
  const dateStr = d.toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const aptIdTag = `[APT:${aptId}]`;
  return lang === "fr"
    ? `Rendez-vous proche : ${patientName} avec Dr. ${doctorName} le ${dateStr} à ${timeStr} ${aptIdTag}`
    : `موعد قريب: ${patientName} مع د. ${doctorName} بتاريخ ${dateStr} الساعة ${timeStr} ${aptIdTag}`;
};

// ---------------------------------------------------------------------------
// Deletion helpers
// ---------------------------------------------------------------------------

/**
 * Delete every notification row tied to the given appointment id,
 * regardless of which user it belongs to.
 */
export const deleteAptNotifications = async (aptId: string): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allNotifs: any[] = await crudApi.getAll("notifications");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const related = allNotifs.filter((n: any) => {
      if (!n?.message) return false;
      return (
        n.message.includes(`[APT:${aptId}]`) ||
        n.message.includes(`(ID: ${aptId})`) ||
        n.message.includes(aptId)
      );
    });
    for (const n of related) {
      try {
        await crudApi.delete("notifications", n.id);
      } catch {
        /* silent: one failure shouldn't block the rest */
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[apptNotifications] Failed to cleanup notifications:", e);
  }
};

// ---------------------------------------------------------------------------
// "Should this apt have a notification right now?"
// ---------------------------------------------------------------------------

/**
 * An appointment should currently carry an active reminder notification iff:
 *   - its status is neither "ملغي" (cancelled) nor "مكتمل" (completed),
 *   - its date is in the future, AND
 *   - it starts within `APT_NOTIF_WINDOW_MS` from now.
 *
 * Beyond the window we still keep things clean (no stale notifications),
 * Topbar will auto-create a reminder when the appointment enters the window.
 */
export const shouldHaveNotif = (dateISO: string, status: string): boolean => {
  if (status === "ملغي" || status === "مكتمل") return false;
  const aptTime = new Date(dateISO).getTime();
  if (Number.isNaN(aptTime)) return false;
  const now = Date.now();
  const diff = aptTime - now;
  return diff > 0 && diff <= APT_NOTIF_WINDOW_MS;
};

// ---------------------------------------------------------------------------
// Per-user notification create
// ---------------------------------------------------------------------------

/**
 * Create a fresh reminder notification for the given appointment, for ONE user.
 * Safe to call right after create/edit; silently fails on transport errors
 * so the caller's main mutation is never blocked.
 */
export const createAptNotification = async (params: {
  aptId: string;
  dateISO: string;
  userId: string;
  title: string;
  patientName: string;
  doctorName: string;
  lang: "ar" | "fr" | string;
  locale: string;
}): Promise<void> => {
  const { aptId, dateISO, userId, title, patientName, doctorName, lang, locale } = params;
  if (!userId) return;
  try {
    await crudApi.insert("notifications", {
      user_id: userId,
      title,
      message: buildAptNotifMessage({ aptId, dateISO, patientName, doctorName, lang, locale }),
      type: "warning",
      read: false,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[apptNotifications] Failed to create notification:", e);
  }
};

// ---------------------------------------------------------------------------
// Recipient computation
// ---------------------------------------------------------------------------

/**
 * Resolve every user id that should receive the reminder notification for
 * this appointment, across ALL roles:
 *
 *   - The appointment's doctor (`doctor_id`)
 *   - The parent (via patient.parent_id -> parents.user_id)
 *   - The service admin who created the doctor (admin / مصلحة)
 *   - Every super_admin (supervisor / مشرف)
 *   - Every receptionist belonging to the same service (same `created_by`
 *     as the doctor, or the doctor itself)
 *
 * All outputs are deduplicated and filtered to non-empty strings.
 */
export const resolveAptNotificationRecipients = (params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doctorId: string | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patientId: string | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patients: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parents: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profiles: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userRoles: any[];
}): string[] => {
  const { doctorId, patientId, patients, parents, profiles, userRoles } = params;
  const recipients = new Set<string>();

  // 1) The doctor
  if (doctorId) recipients.add(doctorId);

  // 2) The parent (via patient -> parents.user_id)
  if (patientId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patient = patients.find((p: any) => p.id === patientId);
    if (patient?.parent_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parent = parents.find((pr: any) => pr.id === patient.parent_id);
      if (parent?.user_id) recipients.add(parent.user_id);
    }
  }

  // 3) Service scope: same `created_by` group as the doctor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doctorProfile = doctorId ? profiles.find((p: any) => p.id === doctorId) : null;
  const serviceAdminId: string | null = doctorProfile?.created_by || null;

  // Admin who owns this service
  if (serviceAdminId) recipients.add(serviceAdminId);

  // All receptionists in the same service (same created_by as doctor, OR
  // created by the service admin itself). We identify receptionists via the
  // user_roles table.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const receptionistIds = new Set<string>(
    userRoles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.role === "receptionist")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.user_id)
      .filter(Boolean)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profiles.forEach((p: any) => {
    if (!p?.id || !receptionistIds.has(p.id)) return;
    if (!serviceAdminId) return;
    // Same service if the receptionist was created by the service admin,
    // or is the service admin themself (edge case).
    if (p.created_by === serviceAdminId || p.id === serviceAdminId) {
      recipients.add(p.id);
    }
  });

  // 4) Every super_admin (supervisor) always gets the notification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userRoles.forEach((r: any) => {
    if (r?.role === "super_admin" && r.user_id) {
      recipients.add(r.user_id);
    }
  });

  return Array.from(recipients).filter(Boolean);
};

// ---------------------------------------------------------------------------
// Fan-out sync: "make the DB match the current appointment state"
// ---------------------------------------------------------------------------

/**
 * Delete every existing notification for the given appointment, then — if
 * the appointment should currently carry a reminder — recreate one fresh
 * notification for every recipient (doctor, parent, admin, super_admin,
 * receptionists of the service).
 *
 * Safe to call from appointment create / edit / delete flows. On delete,
 * pass `status: "ملغي"` (or just let the caller only run `deleteAptNotifications`).
 */
export const syncAptNotifications = async (params: {
  aptId: string;
  dateISO: string;
  status: string;
  doctorId: string | null | undefined;
  patientId: string | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patients: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parents: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profiles: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userRoles: any[];
  title: string;
  lang: "ar" | "fr" | string;
  locale: string;
}): Promise<void> => {
  const {
    aptId,
    dateISO,
    status,
    doctorId,
    patientId,
    patients,
    parents,
    profiles,
    userRoles,
    title,
    lang,
    locale,
  } = params;

  // 1) Always wipe any stale notifications for this appointment first.
  await deleteAptNotifications(aptId);

  // 2) Decide whether a fresh notification should exist at all.
  if (!shouldHaveNotif(dateISO, status)) return;

  // 3) Compute recipients and fan out.
  const recipients = resolveAptNotificationRecipients({
    doctorId,
    patientId,
    patients,
    parents,
    profiles,
    userRoles,
  });
  if (recipients.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patientName = patients.find((p: any) => p.id === patientId)?.name || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doctorName = profiles.find((p: any) => p.id === doctorId)?.full_name || "";

  // Issue inserts in parallel — each failure is swallowed inside the helper.
  await Promise.all(
    recipients.map((userId) =>
      createAptNotification({
        aptId,
        dateISO,
        userId,
        title,
        patientName,
        doctorName,
        lang,
        locale,
      })
    )
  );
};