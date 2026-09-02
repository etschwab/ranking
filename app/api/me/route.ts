import { getCurrentUser, signInPath, signOutPath } from '@/app/auth';
import { getUserProfile } from '@/db/profiles';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const returnTo = new URL(request.url).searchParams.get('returnTo') ?? '/';
  const profile = user ? await getUserProfile(user) : null;
  return Response.json({
    user: profile,
    signInPath: signInPath(returnTo),
    signOutPath: signOutPath('/'),
  });
}
