import { useBackendStatus } from '@/hooks';

export function ConnectionStatus() {
  const { isConnected, isLoading } = useBackendStatus();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
        <span className="text-xs text-gray-600">Connecting...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span className="text-xs text-red-700">Backend Offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
      <div className="w-2 h-2 bg-green-500 rounded-full" />
      <span className="text-xs text-green-700">Connected</span>
    </div>
  );
}

export function ConnectionBanner() {
  const { isConnected, isLoading } = useBackendStatus();

  if (isLoading || isConnected) {
    return null;
  }

  return (
    <div className="bg-red-600 text-white px-4 py-2 text-center text-sm">
      <strong>Backend Offline:</strong> API server is not running. Start with{' '}
      <code className="bg-red-700 px-1 rounded">docker compose up</code>
    </div>
  );
}
