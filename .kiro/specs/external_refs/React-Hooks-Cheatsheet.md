# React Hooks Cheatsheet

**Source**: https://react.dev/reference/react/hooks  
**Last Updated**: February 3, 2026  
**Status**: ✅ VERIFIED (Official React Documentation)

---

## 📚 Overview

Hooks let you use different React features from your components. You can either use the built-in Hooks or combine them to build your own.

---

## 🎯 State Hooks

State lets a component "remember" information like user input.

### useState

**Purpose**: Add state to a component

**Syntax**:
```typescript
const [state, setState] = useState(initialState);
```

**Example**:
```typescript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

**With TypeScript**:
```typescript
const [count, setCount] = useState<number>(0);
const [user, setUser] = useState<User | null>(null);
```

**Functional Updates**:
```typescript
// When new state depends on previous state
setCount(prevCount => prevCount + 1);
```

---

### useReducer

**Purpose**: Manage complex state logic

**Syntax**:
```typescript
const [state, dispatch] = useReducer(reducer, initialState);
```

**Example**:
```typescript
import { useReducer } from 'react';

type State = { count: number };
type Action = { type: 'increment' } | { type: 'decrement' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    default:
      return state;
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });
  
  return (
    <>
      <p>Count: {state.count}</p>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
    </>
  );
}
```

---

## 🔗 Context Hooks

Context lets a component receive information from distant parents without passing it as props.

### useContext

**Purpose**: Read and subscribe to context

**Syntax**:
```typescript
const value = useContext(SomeContext);
```

**Example**:
```typescript
import { createContext, useContext } from 'react';

// Create context
const ThemeContext = createContext<'light' | 'dark'>('light');

// Provider
function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Toolbar />
    </ThemeContext.Provider>
  );
}

// Consumer
function Toolbar() {
  const theme = useContext(ThemeContext);
  return <div className={theme}>Toolbar</div>;
}
```

---

## 📌 Ref Hooks

Refs let a component hold information that isn't used for rendering, like a DOM node or a timeout ID.

### useRef

**Purpose**: Reference a value that doesn't trigger re-renders

**Syntax**:
```typescript
const ref = useRef(initialValue);
```

**Example (DOM reference)**:
```typescript
import { useRef } from 'react';

function TextInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const focusInput = () => {
    inputRef.current?.focus();
  };
  
  return (
    <>
      <input ref={inputRef} />
      <button onClick={focusInput}>Focus</button>
    </>
  );
}
```

**Example (Mutable value)**:
```typescript
function Timer() {
  const intervalRef = useRef<number | null>(null);
  
  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      console.log('tick');
    }, 1000);
  };
  
  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };
  
  return (
    <>
      <button onClick={startTimer}>Start</button>
      <button onClick={stopTimer}>Stop</button>
    </>
  );
}
```

---

## ⚡ Effect Hooks

Effects let a component connect to and synchronize with external systems.

### useEffect

**Purpose**: Synchronize with external systems

**Syntax**:
```typescript
useEffect(() => {
  // Effect code
  return () => {
    // Cleanup code (optional)
  };
}, [dependencies]);
```

**Example (Data fetching)**:
```typescript
import { useState, useEffect } from 'react';

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    let cancelled = false;
    
    async function fetchUser() {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();
      
      if (!cancelled) {
        setUser(data);
      }
    }
    
    fetchUser();
    
    return () => {
      cancelled = true; // Cleanup
    };
  }, [userId]); // Re-run when userId changes
  
  return <div>{user?.name}</div>;
}
```

**Example (Subscriptions)**:
```typescript
useEffect(() => {
  const subscription = someAPI.subscribe(data => {
    console.log(data);
  });
  
  return () => {
    subscription.unsubscribe(); // Cleanup
  };
}, []);
```

**Common Patterns**:
```typescript
// Run once on mount
useEffect(() => {
  console.log('Component mounted');
}, []);

// Run on every render (usually avoid this)
useEffect(() => {
  console.log('Component rendered');
});

// Run when specific values change
useEffect(() => {
  console.log('Count changed:', count);
}, [count]);
```

---

### useLayoutEffect

**Purpose**: Fire before browser repaints (synchronous)

**Use when**: You need to measure DOM or prevent visual flicker

**Syntax**: Same as `useEffect`

```typescript
import { useLayoutEffect, useRef, useState } from 'react';

function Tooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  
  useLayoutEffect(() => {
    const { height } = ref.current!.getBoundingClientRect();
    setTooltipHeight(height);
  }, []);
  
  return <div ref={ref}>Tooltip</div>;
}
```

---

## 🚀 Performance Hooks

Optimize re-rendering performance by skipping unnecessary work.

### useMemo

**Purpose**: Cache expensive calculations

**Syntax**:
```typescript
const cachedValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);
```

**Example**:
```typescript
import { useMemo } from 'react';

function TodoList({ todos, filter }: Props) {
  const filteredTodos = useMemo(() => {
    return todos.filter(todo => {
      // Expensive filtering logic
      return todo.status === filter;
    });
  }, [todos, filter]); // Only recompute when these change
  
  return (
    <ul>
      {filteredTodos.map(todo => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

---

### useCallback

**Purpose**: Cache function definitions

**Syntax**:
```typescript
const cachedFn = useCallback(() => {
  // Function body
}, [dependencies]);
```

**Example**:
```typescript
import { useCallback } from 'react';

function ProductPage({ productId }: Props) {
  const handleSubmit = useCallback((orderDetails) => {
    post('/product/' + productId + '/buy', {
      referrer,
      orderDetails,
    });
  }, [productId]); // Only recreate when productId changes
  
  return <ShippingForm onSubmit={handleSubmit} />;
}
```

**When to use**:
- Passing callbacks to optimized child components
- Function is a dependency of another hook

---

## 🔧 Other Useful Hooks

### useId

**Purpose**: Generate unique IDs for accessibility

**Syntax**:
```typescript
const id = useId();
```

**Example**:
```typescript
import { useId } from 'react';

function PasswordField() {
  const passwordHintId = useId();
  
  return (
    <>
      <input
        type="password"
        aria-describedby={passwordHintId}
      />
      <p id={passwordHintId}>
        Password must be at least 8 characters
      </p>
    </>
  );
}
```

---

## 📋 Common Patterns for Vaughan-Tauri

### Pattern 1: Calling Tauri Commands

```typescript
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

function Balance() {
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchBalance() {
      try {
        const result = await invoke<string>('get_balance');
        setBalance(result);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchBalance();
  }, []);
  
  if (loading) return <div>Loading...</div>;
  return <div>Balance: {balance}</div>;
}
```

### Pattern 2: Managing Form State

```typescript
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

function SendForm() {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    
    try {
      await invoke('send_transaction', { recipient, amount });
      // Reset form
      setRecipient('');
      setAmount('');
    } catch (error) {
      console.error('Transaction failed:', error);
    } finally {
      setSending(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="Recipient address"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
      />
      <button type="submit" disabled={sending}>
        {sending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
```

### Pattern 3: Network Switching

```typescript
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

function NetworkSelector() {
  const [currentNetwork, setCurrentNetwork] = useState<string>('');
  const [networks, setNetworks] = useState<string[]>([]);
  
  useEffect(() => {
    async function loadNetworks() {
      const nets = await invoke<string[]>('get_networks');
      setNetworks(nets);
      
      const current = await invoke<string>('get_current_network');
      setCurrentNetwork(current);
    }
    
    loadNetworks();
  }, []);
  
  const switchNetwork = async (network: string) => {
    try {
      await invoke('switch_network', { network });
      setCurrentNetwork(network);
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
  };
  
  return (
    <select
      value={currentNetwork}
      onChange={(e) => switchNetwork(e.target.value)}
    >
      {networks.map(net => (
        <option key={net} value={net}>{net}</option>
      ))}
    </select>
  );
}
```

---

## ⚠️ Common Mistakes

### ❌ DON'T: Mutate state directly
```typescript
// Wrong
const [items, setItems] = useState([1, 2, 3]);
items.push(4); // Mutation!
```

### ✅ DO: Create new state
```typescript
// Correct
setItems([...items, 4]);
```

---

### ❌ DON'T: Call hooks conditionally
```typescript
// Wrong
if (condition) {
  const [state, setState] = useState(0); // Error!
}
```

### ✅ DO: Call hooks at top level
```typescript
// Correct
const [state, setState] = useState(0);
if (condition) {
  // Use state here
}
```

---

### ❌ DON'T: Forget dependencies
```typescript
// Wrong - missing 'count' dependency
useEffect(() => {
  console.log(count);
}, []);
```

### ✅ DO: Include all dependencies
```typescript
// Correct
useEffect(() => {
  console.log(count);
}, [count]);
```

---

## 📚 Additional Resources

- **Official Docs**: https://react.dev/reference/react/hooks
- **TypeScript**: https://react.dev/learn/typescript
- **Rules of Hooks**: https://react.dev/reference/rules/rules-of-hooks

---

**Remember**: Hooks must be called at the top level of your component, not inside loops, conditions, or nested functions!
