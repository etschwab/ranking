import { getCurrentUser } from '@/app/auth';
import { getUserProfile, saveUserProfile } from '@/db/profiles';

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return Response.json(
      { error: 'Bitte melde dich zuerst an.' },
      { status: 401 },
    );
  return Response.json(await getUserProfile(user));
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return Response.json(
      { error: 'Bitte melde dich zuerst an.' },
      { status: 401 },
    );
  const body = (await request.json()) as { displayName?: unknown };
  const displayName =
    typeof body.displayName === 'string'
      ? body.displayName.trim().slice(0, 50)
      : '';
  if (displayName.length < 2) {
    return Response.json(
      { error: 'Bitte gib einen Namen mit mindestens 2 Zeichen ein.' },
      { status: 400 },
    );
  }
  return Response.json(await saveUserProfile(user, displayName));
}
