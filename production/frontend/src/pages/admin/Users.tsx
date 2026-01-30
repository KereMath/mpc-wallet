import { useState } from 'react';
import { Card, CardHeader, CardTitle, Button, Input, Select, Modal, Badge } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { formatDate } from '@/utils/formatters';

export function UsersPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const { users, createUser, deleteUser, user: currentUser } = useAuthStore();
  const { addToast } = useUiStore();

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');

  const handleCreateUser = () => {
    if (!newUsername || !newPassword) {
      addToast({ message: 'Please fill all fields', type: 'error' });
      return;
    }

    const success = createUser(newUsername, newPassword, newRole);
    if (success) {
      addToast({ message: `User "${newUsername}" created successfully`, type: 'success' });
      setShowCreateModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
    } else {
      addToast({ message: 'Username already exists', type: 'error' });
    }
  };

  const handleDeleteUser = (userId: string) => {
    const success = deleteUser(userId);
    if (success) {
      addToast({ message: 'User deleted successfully', type: 'success' });
    } else {
      addToast({ message: 'Cannot delete the last admin', type: 'error' });
    }
    setShowDeleteModal(null);
  };

  const admins = users.filter((u) => u.role === 'admin');
  const regularUsers = users.filter((u) => u.role === 'user');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <Button onClick={() => setShowCreateModal(true)}>Add User</Button>
      </div>

      <p className="text-gray-600">
        Manage admin and user accounts. Users can access the wallet interface, while admins
        can manage the cluster configuration.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div>
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold mt-1">{users.length}</p>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-sm text-gray-500">Administrators</p>
            <p className="text-2xl font-bold mt-1">{admins.length}</p>
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-sm text-gray-500">Regular Users</p>
            <p className="text-2xl font-bold mt-1">{regularUsers.length}</p>
          </div>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3 font-medium">Username</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Created</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="text-sm">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                        {user.username[0].toUpperCase()}
                      </div>
                      <span className="font-medium">{user.username}</span>
                      {user.id === currentUser?.id && (
                        <Badge variant="info" size="sm">You</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    <Badge variant={user.role === 'admin' ? 'warning' : 'default'}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="py-3 text-gray-500">
                    {user.createdAt ? formatDate(user.createdAt) : 'Default'}
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteModal(user.id)}
                      disabled={user.id === currentUser?.id}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
      >
        <div className="space-y-4">
          <Input
            label="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Enter username"
          />

          <Input
            label="Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter password"
          />

          <Select
            label="Role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
            options={[
              { value: 'user', label: 'User' },
              { value: 'admin', label: 'Administrator' },
            ]}
          />

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)} fullWidth>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} fullWidth>
              Create User
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal !== null}
        onClose={() => setShowDeleteModal(null)}
        title="Delete User"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this user? This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(null)} fullWidth>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => showDeleteModal && handleDeleteUser(showDeleteModal)}
            fullWidth
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
