export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome to your project management dashboard.</p>
      
      <div className="grid grid-cols-1 gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder cards */}
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900">Recent Projects</h3>
          <p className="mt-2 text-gray-500">No projects yet.</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900">My Issues</h3>
          <p className="mt-2 text-gray-500">No active issues.</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900">Team Activity</h3>
          <p className="mt-2 text-gray-500">No recent activity.</p>
        </div>
      </div>
    </div>
  );
}
