import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from '@/app/chatgpt-auth';
import { getUserProfile } from '@/db/profiles';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const returnTo = new URL(request.url).searchParams.get('returnTo') ?? '/';
  const profile = user ? await getUserProfile(user) : null;
  return Response.json({
    user: profile,
    signInPath: chatGPTSignInPath(returnTo),
    signOutPath: chatGPTSignOutPath('/'),
  });
}
