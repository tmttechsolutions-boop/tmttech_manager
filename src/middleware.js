import { updateSession } from '@/lib/supabase-middleware'

export async function middleware(request) {
    // Ignora chamadas para arquivos estáticos e imagens
    if (request.nextUrl.pathname.startsWith('/_next') || request.nextUrl.pathname.includes('.')) {
        return;
    }
    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
