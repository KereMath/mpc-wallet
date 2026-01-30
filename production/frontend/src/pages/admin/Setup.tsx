import { useState } from 'react';
import { Card, CardHeader, CardTitle, Button, Select, Input, Badge } from '@/components/common';
import { useDkgStatus, useInitiateDkg, useAuxInfoStatus, useGenerateAuxInfo } from '@/hooks';
import { useUiStore } from '@/stores/uiStore';
import { truncateAddress } from '@/utils/formatters';

export function SetupPage() {
  const [protocol, setProtocol] = useState<'cggmp24' | 'frost'>('cggmp24');
  const [threshold, setThreshold] = useState(4);
  const [totalNodes, setTotalNodes] = useState(5);

  const { data: dkgStatus, isLoading: dkgLoading } = useDkgStatus();
  const { data: auxInfoStatus, isLoading: auxLoading } = useAuxInfoStatus();

  const initiateDkg = useInitiateDkg();
  const generateAuxInfo = useGenerateAuxInfo();

  const { addToast } = useUiStore();

  const handleInitiateDkg = async () => {
    try {
      await initiateDkg.mutateAsync({
        protocol,
        threshold,
        total_nodes: totalNodes,
      });
      addToast({ message: 'DKG ceremony initiated successfully', type: 'success' });
    } catch (error) {
      addToast({ message: 'Failed to initiate DKG', type: 'error' });
    }
  };

  const handleGenerateAuxInfo = async () => {
    try {
      await generateAuxInfo.mutateAsync();
      addToast({ message: 'Aux info generation started', type: 'success' });
    } catch (error) {
      addToast({ message: 'Failed to generate aux info', type: 'error' });
    }
  };

  const hasDkgCompleted = (dkgStatus?.total_completed ?? 0) > 0;
  const hasAuxInfo = auxInfoStatus?.has_aux_info ?? false;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Initial Setup</h1>

      <p className="text-gray-600">
        Configure the MPC wallet cluster. These are one-time setup operations that initialize
        the threshold cryptography system.
      </p>

      {/* DKG Section */}
      <Card>
        <CardHeader>
          <CardTitle>Distributed Key Generation (DKG)</CardTitle>
          {hasDkgCompleted ? (
            <Badge variant="success">Completed</Badge>
          ) : (
            <Badge variant="warning">Not Configured</Badge>
          )}
        </CardHeader>

        <p className="text-sm text-gray-600 mb-4">
          Generate threshold key shares across all nodes. Each node will hold a secret share
          of the private key. No single node can access the complete key.
        </p>

        {!hasDkgCompleted && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Select
              label="Protocol"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as 'cggmp24' | 'frost')}
              options={[
                { value: 'cggmp24', label: 'CGGMP24 (ECDSA/SegWit)' },
                { value: 'frost', label: 'FROST (Schnorr/Taproot)' },
              ]}
            />

            <Input
              label="Threshold"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              min={2}
              max={totalNodes}
            />

            <Input
              label="Total Nodes"
              type="number"
              value={totalNodes}
              onChange={(e) => setTotalNodes(Number(e.target.value))}
              min={3}
              max={10}
            />
          </div>
        )}

        {hasDkgCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-green-800 mb-2">DKG Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {dkgStatus?.cggmp24_address && (
                <div>
                  <p className="text-gray-500">CGGMP24 Address</p>
                  <p className="font-mono text-green-700">
                    {truncateAddress(dkgStatus.cggmp24_address, 10)}
                  </p>
                </div>
              )}
              {dkgStatus?.frost_address && (
                <div>
                  <p className="text-gray-500">FROST Address</p>
                  <p className="font-mono text-green-700">
                    {truncateAddress(dkgStatus.frost_address, 10)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Ceremonies Completed</p>
                <p className="font-medium text-green-700">{dkgStatus?.total_completed}</p>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleInitiateDkg}
          loading={initiateDkg.isPending}
          disabled={hasDkgCompleted || dkgLoading}
        >
          {hasDkgCompleted ? 'DKG Already Completed' : 'Initiate DKG'}
        </Button>
      </Card>

      {/* Aux Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>Auxiliary Information</CardTitle>
          {hasAuxInfo ? (
            <Badge variant="success">Generated</Badge>
          ) : (
            <Badge variant="warning">Not Generated</Badge>
          )}
        </CardHeader>

        <p className="text-sm text-gray-600 mb-4">
          Generate auxiliary cryptographic parameters (Paillier keys, ring-Pedersen parameters)
          required for CGGMP24 presignature generation. This must be done after DKG.
        </p>

        {hasAuxInfo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-green-800 mb-2">Aux Info Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Size</p>
                <p className="font-medium text-green-700">
                  {((auxInfoStatus?.aux_info_size_bytes ?? 0) / 1024).toFixed(1)} KB
                </p>
              </div>
              <div>
                <p className="text-gray-500">Ceremonies</p>
                <p className="font-medium text-green-700">{auxInfoStatus?.total_ceremonies}</p>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleGenerateAuxInfo}
          loading={generateAuxInfo.isPending}
          disabled={!hasDkgCompleted || auxLoading}
          variant={hasAuxInfo ? 'secondary' : 'primary'}
        >
          {!hasDkgCompleted
            ? 'Complete DKG First'
            : hasAuxInfo
            ? 'Regenerate Aux Info'
            : 'Generate Aux Info'}
        </Button>
      </Card>

      {/* Setup Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Progress</CardTitle>
        </CardHeader>

        <div className="space-y-3">
          <SetupStep
            number={1}
            title="DKG Ceremony"
            description="Generate threshold key shares"
            completed={hasDkgCompleted}
          />
          <SetupStep
            number={2}
            title="Aux Info Generation"
            description="Generate cryptographic parameters"
            completed={hasAuxInfo}
          />
          <SetupStep
            number={3}
            title="Presignature Pool"
            description="Pre-generate signatures for fast transactions"
            completed={false}
          />
        </div>
      </Card>
    </div>
  );
}

function SetupStep({
  number,
  title,
  description,
  completed,
}: {
  number: number;
  title: string;
  description: string;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
          completed
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        {completed ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          number
        )}
      </div>
      <div>
        <p className={`font-medium ${completed ? 'text-green-700' : 'text-gray-700'}`}>
          {title}
        </p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}
