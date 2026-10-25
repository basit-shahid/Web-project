import React from 'react';

const accounts = [
  { name: 'Administrator', email: 'admin@novaworks.example', purpose: 'Import the sample meeting plan' },
  { name: 'Ayesha · Manager', email: 'ayesha@novaworks.example', purpose: 'View assigned projects' },
  { name: 'Ali · Developer', email: 'ali@novaworks.example', purpose: 'View assigned tasks' },
];

export default function DemoAccounts({ onSelect, disabled, selectedEmail }) {
  return <section className="demo-accounts" aria-labelledby="demo-accounts-title">
    <h2 id="demo-accounts-title">Choose a demo role</h2>
    <p>Fictional roles for presentation. Select a role to fill the demo credentials, then Sign in. Data stays in this browser; this is not secure authentication.</p>
    <div className="demo-account-options">{accounts.map(account =>
      <button type="button" className="secondary" key={account.email} disabled={disabled} aria-pressed={selectedEmail===account.email}
        onClick={()=>onSelect({ email: account.email, password: 'Demo123!' })}>
        <strong>{account.name}</strong><span>{account.purpose}</span>
      </button>
    )}</div>
  </section>;
}