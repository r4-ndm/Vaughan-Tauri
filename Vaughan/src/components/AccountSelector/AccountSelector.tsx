import { useState, useEffect } from 'react';
import { ChevronDownIcon, CheckIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { TauriService } from '../../services/tauri';
import { formatAddress } from '../../utils/format';
import type { Account } from '../../types';

/**
 * AccountSelector Component
 * 
 * Displays current account and allows switching between accounts.
 * Uses Headless UI Menu for accessible dropdown functionality.
 */
export function AccountSelector() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load accounts on mount
  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoading(true);
        setError(null);
        
        const accountList = await TauriService.getAccounts();
        setAccounts(accountList);
        
        // First account is active by default
        if (accountList.length > 0) {
          setActiveAccount(accountList[0]);
        }
      } catch (err) {
        console.error('Failed to load accounts:', err);
        setError('Failed to load accounts');
      } finally {
        setLoading(false);
      }
    }

    loadAccounts();
  }, []);

  // Handle account switch
  const handleAccountSwitch = async (address: string) => {
    if (activeAccount?.address === address) return;

    try {
      setError(null);
      // TODO: Implement switch_account command in backend
      // await TauriService.switchAccount(address);
      
      // For now, just update local state
      const account = accounts.find(acc => acc.address === address);
      if (account) {
        setActiveAccount(account);
      }
    } catch (err) {
      console.error('Failed to switch account:', err);
      setError('Failed to switch account');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
        <div className="w-3 h-3 bg-slate-600 rounded-full animate-pulse" />
        <span className="text-sm text-slate-400">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg">
        <span className="text-sm text-red-400">{error}</span>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="px-4 py-2 bg-slate-800 rounded-lg">
        <span className="text-sm text-slate-400">No accounts</span>
      </div>
    );
  }

  if (!activeAccount) {
    return null;
  }

  return (
    <Menu as="div" className="relative">
      <MenuButton className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors group">
        {/* Account icon */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold">
          {activeAccount.name.charAt(0).toUpperCase()}
        </div>
        
        {/* Account info */}
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-slate-100">
            {activeAccount.name}
          </span>
          <span className="text-xs text-slate-400">
            {formatAddress(activeAccount.address)}
          </span>
        </div>
        
        {/* Dropdown icon */}
        <ChevronDownIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-300 transition-colors ml-2" />
      </MenuButton>

      <MenuItems className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
        {/* Account list */}
        {accounts.map((account) => {
          const isActive = account.address === activeAccount.address;
          
          return (
            <MenuItem key={account.address}>
              {({ focus }) => (
                <button
                  onClick={() => handleAccountSwitch(account.address)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                    ${focus ? 'bg-slate-700' : ''}
                    ${isActive ? 'bg-slate-700/50' : ''}
                  `}
                >
                  {/* Account icon */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {account.name.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* Account info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-100">
                      {account.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatAddress(account.address)}
                    </div>
                  </div>
                  
                  {/* Active indicator */}
                  {isActive && (
                    <CheckIcon className="w-5 h-5 text-primary-500 flex-shrink-0" />
                  )}
                </button>
              )}
            </MenuItem>
          );
        })}

        {/* Divider */}
        <div className="border-t border-slate-700" />

        {/* Create new account button */}
        <MenuItem>
          {({ focus }) => (
            <button
              onClick={() => {
                // TODO: Open create account dialog
                console.log('Create new account');
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${focus ? 'bg-slate-700' : ''}
              `}
            >
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                <PlusIcon className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-sm text-slate-300">Create Account</span>
            </button>
          )}
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
