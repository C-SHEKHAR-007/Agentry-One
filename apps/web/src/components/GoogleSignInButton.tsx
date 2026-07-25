import { Button } from "./ui/button";

interface GoogleSignInButtonProps {
  label?: string;
}

export function GoogleSignInButton({ label = "Sign in with Google" }: GoogleSignInButtonProps) {
  const handleClick = () => {
    window.location.assign("/api/auth/google");
  };

  return (
    <div className="space-y-4 mb-4">
      <Button
        type="button"
        variant="outline"
        className="w-full font-medium flex items-center justify-center gap-2.5 py-5 border-border/80 hover:bg-secondary/60 transition-all shadow-sm"
        onClick={handleClick}
      >
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M12 5c1.6 0 3 .5 4.1 1.5l3.1-3.1C17.3 1.6 14.8 0 12 0 7.4 0 3.5 2.6 1.6 6.4l3.7 2.8C6.2 6.3 8.9 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
          />
          <path
            fill="#FBBC05"
            d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.4C.6 9.4 0 11.6 0 14s.6 4.6 1.6 6.6l3.7-2.8z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-4.9L1.6 17.2C3.5 21.1 7.4 24 12 24z"
          />
        </svg>
        <span>{label}</span>
      </Button>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground font-medium">Or continue with email</span>
        </div>
      </div>
    </div>
  );
}
