import { db } from "../client";
import type { CalendarIntegrationEntity } from "../entities";

export interface CreateCalendarIntegrationParams {
  workspace: string;
  google_client_id?: string;
  google_client_secret_encrypted?: string;
}

export async function createCalendarIntegration(params: CreateCalendarIntegrationParams): Promise<CalendarIntegrationEntity> {
  return db.calendarIntegration.create({
    workspace: params.workspace,
    provider: "google",
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    token_expires_at: null,
    calendar_id: null,
    calendar_name: null,
    timezone: "UTC",
    last_error: null,
    google_client_id: params.google_client_id ?? null,
    google_client_secret_encrypted: params.google_client_secret_encrypted ?? null,
  });
}

export async function getCalendarIntegrationByWorkspace(workspaceId: string): Promise<CalendarIntegrationEntity | null> {
  try {
    const integrations = await db.calendarIntegration.getByWorkspace(workspaceId);
    return integrations[0] ?? null;
  } catch {
    return null;
  }
}

export async function updateCalendarIntegration(
  id: string,
  data: Partial<CalendarIntegrationEntity>
): Promise<CalendarIntegrationEntity> {
  return db.calendarIntegration.update(id, data);
}

export async function deleteCalendarIntegration(id: string): Promise<void> {
  await db.calendarIntegration.delete(id);
}