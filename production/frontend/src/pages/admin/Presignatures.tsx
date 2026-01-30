import { useState } from 'react';
import { Card, CardHeader, CardTitle, Button, Input, Badge } from '@/components/common';
import { usePresigStatus, useGeneratePresignatures } from '@/hooks';
import { useUiStore } from '@/stores/uiStore';

export function PresignaturesPage() {
  const [count, setCount] = useState(10);
  const { data: status, isLoading } = usePresigStatus({ refetchInterval: 5000 });
  const generatePresigs = useGeneratePresignatures();
  const { addToast } = useUiStore();

  const handleGenerate = async () => {
    try {
      const result = await generatePresigs.mutateAsync(count);
      addToast({
        message: `Generated ${result.generated} presignatures in ${result.duration_ms}ms`,
        type: 'success',
      });
    } catch (error) {
      addToast({ message: 'Failed to generate presignatures', type: 'error' });
    }
  };

  const utilization = status?.utilization ?? 0;
  const currentSize = status?.current_size ?? 0;
  const targetSize = status?.target_size ?? 100;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Presignature Pool</h1>

      <p className="text-gray-600">
        Presignatures enable fast transaction signing (~180ms vs ~2s). The pool is automatically
        maintained but can be manually refilled.
      </p>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Current Pool</p>
              <p className="text-2xl font-bold mt-1">{currentSize}</p>
            </div>
            <PoolHealthBadge status={status} />
          </div>
        </Card>

        <Card>
          <div>
            <p className="text-sm text-gray-500">Target Size</p>
            <p className="text-2xl font-bold mt-1">{targetSize}</p>
          </div>
        </Card>

        <Card>
          <div>
            <p className="text-sm text-gray-500">Hourly Usage</p>
            <p className="text-2xl font-bold mt-1">{status?.hourly_usage ?? 0}</p>
          </div>
        </Card>

        <Card>
          <div>
            <p className="text-sm text-gray-500">Total Generated</p>
            <p className="text-2xl font-bold mt-1">{status?.total_generated ?? 0}</p>
          </div>
        </Card>
      </div>

      {/* Utilization Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Utilization</CardTitle>
          <span className="text-sm text-gray-500">{utilization.toFixed(1)}%</span>
        </CardHeader>

        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              status?.is_critical
                ? 'bg-red-500'
                : status?.is_healthy
                ? 'bg-green-500'
                : 'bg-yellow-500'
            }`}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>

        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>0</span>
          <span>Critical (10)</span>
          <span>Healthy (20)</span>
          <span>Target ({targetSize})</span>
          <span>Max ({status?.max_size ?? 150})</span>
        </div>
      </Card>

      {/* Manual Generation */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Generation</CardTitle>
        </CardHeader>

        <p className="text-sm text-gray-600 mb-4">
          Manually trigger presignature generation. Each presignature takes ~1.5 seconds to generate.
        </p>

        <div className="flex items-end gap-4">
          <Input
            label="Count"
            type="number"
            value={count}
            onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value))))}
            min={1}
            max={50}
            className="w-32"
          />

          <Button
            onClick={handleGenerate}
            loading={generatePresigs.isPending}
            disabled={isLoading}
          >
            Generate {count} Presignatures
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Maximum 50 presignatures per request. Estimated time: ~{(count * 1.5).toFixed(0)} seconds.
        </p>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Total Generated</p>
            <p className="text-xl font-semibold">{status?.total_generated ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Used</p>
            <p className="text-xl font-semibold">{status?.total_used ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Available</p>
            <p className="text-xl font-semibold">{currentSize}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Usage Rate</p>
            <p className="text-xl font-semibold">{status?.hourly_usage ?? 0}/hr</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PoolHealthBadge({ status }: { status?: { is_healthy?: boolean; is_critical?: boolean } }) {
  if (status?.is_critical) return <Badge variant="danger">Critical</Badge>;
  if (status?.is_healthy) return <Badge variant="success">Healthy</Badge>;
  return <Badge variant="warning">Low</Badge>;
}
