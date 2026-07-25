export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full" style={{ maxWidth: 420 }}>
        {children}
      </div>
    </div>
  );
}
