'use client';

import { useState } from 'react';

export default function Home() {
  const [sokojUrl, setSokojUrl] = useState(null);
  const [ofpsUrl, setOfpsUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSokojUrl(null);
    setOfpsUrl(null);

    const formData = new FormData(e.target);
    const res = await fetch('/api/process', {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();

    const toBlobUrl = (base64, type) => {
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      return URL.createObjectURL(new Blob([array], { type }));
    };

    setSokojUrl(toBlobUrl(result.sokoj, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    setOfpsUrl(toBlobUrl(result.ofps, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    setLoading(false);
  };

  const handleFileChange = (e) => {
    setFileCount(e.target.files.length);
  };

  return (
    <main className="flex flex-col max-w-2xl mx-auto p-6 space-y-6">
      <form onSubmit={handleUpload} encType="multipart/form-data" className="flex flex-col items-center space-y-4">
        <label className="block text-xl font-medium mb-6">Кошуљице за СОКОЈ и ОФПС</label>

        <input
          id="fileInput"
          type="file"
          name="dbfiles"
          multiple
          accept=".db"
          onChange={handleFileChange}
          className="hidden"
        />

        <label
          htmlFor="fileInput"
          className="cursor-pointer inline-block px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition"
        >
          Унесите .db фајлове
        </label>

        <div className="text-sm text-gray-600">
          {fileCount === 0 ? 'Нема унетих фајлова' : `${fileCount} унето`}
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          {loading ? 'Обрађујем...' : 'Конвертуј'}
        </button>
      </form>

      {loading && (
        <div className="flex justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && sokojUrl && ofpsUrl && (
        <div className="flex items-center justify-evenly">
          <a href={sokojUrl} download="sokoj.xlsx" className="text-green-600 hover:underline">
            СОКОЈ
          </a>
          <a href={ofpsUrl} download="ofps.xlsx" className="text-green-600 hover:underline ">
            ОФПС
          </a>
        </div>
      )}
    </main>
  );
}
