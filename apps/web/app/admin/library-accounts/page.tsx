'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@chefsbook/db';
import { adminFetch, adminPost } from '@/lib/adminFetch';
import { useConfirmDialog, useAlertDialog } from '@/components/useConfirmDialog';
import Link from 'next/link';

interface LibraryAccount {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  recipe_count: number;
  follower_count: number;
  created_at: string;
}

interface LibraryToken {
  id: string;
  description: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  created_by_username: string | null;
}

export default function LibraryAccountsPage() {
  const [accounts, setAccounts] = useState<LibraryAccount[]>([]);
  const [tokens, setTokens] = useState<Map<string, LibraryToken[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState<string | null>(null);
  const [tokenDescription, setTokenDescription] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirm, ConfirmDialog] = useConfirmDialog();
  const [showAlert, AlertDialog] = useAlertDialog();

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch({ page: 'library-accounts' });
      setAccounts(data.accounts || []);

      // Load tokens for each account
      const tokenMap = new Map<string, LibraryToken[]>();
      for (const account of data.accounts || []) {
        if (data.tokens && data.tokens[account.id]) {
          tokenMap.set(account.id, data.tokens[account.id]);
        }
      }
      setTokens(tokenMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleGenerateToken = async (userId: string) => {
    if (!tokenDescription.trim()) {
      await showAlert({ title: 'Description Required', body: 'Please enter a description for this token' });
      return;
    }

    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/admin/library-accounts/${userId}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ description: tokenDescription }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate token');
      }

      const { token } = await response.json();
      setGeneratedToken(token);
      setTokenDescription('');
      await loadAccounts();
    } catch (err) {
      await showAlert({ title: 'Error', body: err instanceof Error ? err.message : 'Failed to generate token' });
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeToken = async (userId: string, tokenId: string) => {
    const confirmed = await confirm({
      title: 'Revoke Token?',
      body: 'This token will no longer work for imports. This action cannot be undone.',
      confirmLabel: 'Revoke',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    setRevoking(tokenId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/admin/library-accounts/${userId}/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to revoke token');
      }

      await loadAccounts();
    } catch (err) {
      await showAlert({ title: 'Error', body: err instanceof Error ? err.message : 'Failed to revoke token' });
    } finally {
      setRevoking(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const closeTokenModal = () => {
    setShowTokenModal(null);
    setTokenDescription('');
    setGeneratedToken(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading library accounts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Library Accounts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Official ChefsBook library accounts for curated recipe collections
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500">No library accounts found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {accounts.map((account) => (
            <div key={account.id} className="bg-white border border-gray-200 rounded-lg p-6">
              {/* Account Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
                  {account.avatar_url ? (
                    <img src={account.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    '📚'
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{account.display_name}</h2>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                      Library
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">@{account.username}</p>
                  {account.bio && (
                    <p className="text-sm text-gray-700 mt-2">{account.bio}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                    <span>{account.recipe_count} recipes</span>
                    <span>{account.follower_count} followers</span>
                    <span>Created {new Date(account.created_at).toLocaleDateString()}</span>
                  </div>
                  <Link
                    href={`/chef/${account.username}`}
                    className="inline-block mt-2 text-sm text-cb-primary hover:underline"
                  >
                    View Profile →
                  </Link>
                </div>
              </div>

              {/* Import Tokens Section */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Import Tokens</h3>
                  <button
                    onClick={() => setShowTokenModal(account.id)}
                    className="px-3 py-1.5 bg-cb-primary text-white text-sm font-medium rounded hover:bg-red-700 transition"
                  >
                    Generate Token
                  </button>
                </div>

                {tokens.get(account.id)?.length === 0 ? (
                  <p className="text-sm text-gray-500">No tokens generated yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-200">
                        <tr className="text-left text-gray-600">
                          <th className="pb-2 font-medium">Description</th>
                          <th className="pb-2 font-medium">Created</th>
                          <th className="pb-2 font-medium">Last Used</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tokens.get(account.id)?.map((token) => (
                          <tr key={token.id} className="text-gray-700">
                            <td className="py-3">{token.description}</td>
                            <td className="py-3">{new Date(token.created_at).toLocaleDateString()}</td>
                            <td className="py-3">
                              {token.last_used_at
                                ? new Date(token.last_used_at).toLocaleString()
                                : 'Never'}
                            </td>
                            <td className="py-3">
                              {token.is_active ? (
                                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                                  Revoked
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              {token.is_active && (
                                <button
                                  onClick={() => handleRevokeToken(account.id, token.id)}
                                  disabled={revoking === token.id}
                                  className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50"
                                >
                                  {revoking === token.id ? 'Revoking...' : 'Revoke'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            {generatedToken ? (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Token Generated</h3>
                <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-4">
                  <p className="text-sm text-amber-800 font-medium mb-2">
                    ⚠️ Save this token now — it cannot be shown again
                  </p>
                  <div className="bg-white border border-amber-300 rounded p-3 font-mono text-sm break-all">
                    {generatedToken}
                  </div>
                  <button
                    onClick={() => copyToClipboard(generatedToken)}
                    className="mt-3 px-3 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition w-full"
                  >
                    Copy to Clipboard
                  </button>
                </div>
                <button
                  onClick={closeTokenModal}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Import Token</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={tokenDescription}
                    onChange={(e) => setTokenDescription(e.target.value)}
                    placeholder="e.g., Food Lab import — May 2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cb-primary"
                    disabled={generating}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleGenerateToken(showTokenModal)}
                    disabled={generating || !tokenDescription.trim()}
                    className="flex-1 px-4 py-2 bg-cb-primary text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? 'Generating...' : 'Generate'}
                  </button>
                  <button
                    onClick={closeTokenModal}
                    disabled={generating}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog />
      <AlertDialog />
    </div>
  );
}
