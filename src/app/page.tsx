export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-4">
        Local Deals Near You
      </h1>

      <p className="text-gray-600 mb-6">
        Find today’s best offers from nearby shops.
      </p>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Example Deal</h2>
        <p>20% off Haircut</p>
        <p className="text-sm text-gray-500">Valid till 8 PM</p>
      </div>
    </main>
  );
}
