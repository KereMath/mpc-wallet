import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

// Mock users for development
const MOCK_USERS = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin' as const },
  { id: '2', username: 'user1', password: 'user123', role: 'user' as const },
  { id: '3', username: 'user2', password: 'user123', role: 'user' as const },
];

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  users: User[]; // For admin user management
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  getUsers: () => User[];
  createUser: (username: string, password: string, role: 'admin' | 'user') => boolean;
  deleteUser: (userId: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      users: MOCK_USERS.map(u => ({ id: u.id, username: u.username, role: u.role })),

      login: async (username: string, password: string) => {
        // Check mock users first
        const mockUser = MOCK_USERS.find(
          u => u.username === username && u.password === password
        );

        if (mockUser) {
          const user: User = {
            id: mockUser.id,
            username: mockUser.username,
            role: mockUser.role,
          };
          const token = btoa(JSON.stringify({ sub: user.id, role: user.role, exp: Date.now() + 86400000 }));

          set({
            token,
            user,
            isAuthenticated: true,
          });
          return true;
        }

        // Check dynamically created users (stored in localStorage via zustand persist)
        const storedUsers = get().users;
        const storedUser = storedUsers.find(u => u.username === username);

        // For dynamic users, check against stored password (in real app, this would be backend)
        const dynamicPasswords = JSON.parse(localStorage.getItem('mpc-user-passwords') || '{}');
        if (storedUser && dynamicPasswords[storedUser.id] === password) {
          const token = btoa(JSON.stringify({ sub: storedUser.id, role: storedUser.role, exp: Date.now() + 86400000 }));

          set({
            token,
            user: storedUser,
            isAuthenticated: true,
          });
          return true;
        }

        return false;
      },

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },

      getUsers: () => {
        return get().users;
      },

      createUser: (username: string, password: string, role: 'admin' | 'user') => {
        const users = get().users;

        // Check if username already exists
        if (users.some(u => u.username === username)) {
          return false;
        }

        const newUser: User = {
          id: crypto.randomUUID(),
          username,
          role,
          createdAt: new Date().toISOString(),
        };

        // Store password separately
        const dynamicPasswords = JSON.parse(localStorage.getItem('mpc-user-passwords') || '{}');
        dynamicPasswords[newUser.id] = password;
        localStorage.setItem('mpc-user-passwords', JSON.stringify(dynamicPasswords));

        set({ users: [...users, newUser] });
        return true;
      },

      deleteUser: (userId: string) => {
        const users = get().users;

        // Don't allow deleting the last admin
        const admins = users.filter(u => u.role === 'admin');
        const userToDelete = users.find(u => u.id === userId);

        if (userToDelete?.role === 'admin' && admins.length <= 1) {
          return false;
        }

        // Remove password
        const dynamicPasswords = JSON.parse(localStorage.getItem('mpc-user-passwords') || '{}');
        delete dynamicPasswords[userId];
        localStorage.setItem('mpc-user-passwords', JSON.stringify(dynamicPasswords));

        set({ users: users.filter(u => u.id !== userId) });
        return true;
      },
    }),
    {
      name: 'mpc-wallet-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        users: state.users,
      }),
    }
  )
);
