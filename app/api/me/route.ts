import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from '@/app/chatgpt-auth';

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const returnTo = new URL(request.url).searchParams.get('returnTo') ?? '/';
  return Response.json({
    user: user ? { displayName: user.displayName, email: user.email } : null,
    signInPath: chatGPTSignInPath(returnTo),
    signOutPath: chatGPTSignOutPath('/'),
  });
}
