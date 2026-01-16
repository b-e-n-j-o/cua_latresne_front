// src/portail/components/DashboardLayoutSkeleton.tsx
export function DashboardLayoutSkeleton() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar skeleton */}
      <div className="w-64 bg-slate-900 p-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-slate-700 rounded-md animate-pulse" />
          <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
        </div>
        
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 w-full bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <div className="h-12 w-48 bg-gray-300 rounded-lg animate-pulse" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-300 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-300 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}