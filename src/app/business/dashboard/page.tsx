'use client';

import { useState } from 'react';

export default function BusinessDashboard() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validTill, setValidTill] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const deal = {
      title,
      description,
      validTill,
    };

    console.log('DEAL DATA:', deal);
    alert('Deal submitted! Check console.');

    setTitle('');
    setDescription('');
    setValidTill('');
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Add Deal</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow max-w-md"
      >
        <div className="mb-4">
          <label className="block font-medium mb-1">
            Deal Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block font-medium mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block font-medium mb-1">
            Valid Till
          </label>
          <input
            type="time"
            value={validTill}
            onChange={(e) => setValidTill(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded"
        >
          Submit Deal
        </button>
      </form>
    </main>
  );
}
