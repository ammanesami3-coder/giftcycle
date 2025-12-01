import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import api from "../../services/api";
import toast from "react-hot-toast";

const AdminDisputes = () => {
  const { user } = useUser();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");

  const isAdmin = Boolean(user?.is_admin);

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) return;

    const fetchDisputes = async () => {
      try {
        setLoading(true);
        const res = await api.get(
          `/disputes${statusFilter ? `?status=${statusFilter}` : ""}`
        );
        setDisputes(res.data || []);
      } catch (err) {
        console.error("Failed to load disputes:", err);
        toast.error("Failed to load disputes list.");
      } finally {
        setLoading(false);
      }
    };

    fetchDisputes();
  }, [user, isAdmin, statusFilter]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-200">
          You must be logged in to access this page.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-red-600 dark:text-red-400 font-semibold">
          You are not authorized to access the admin panel.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-5xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
              Disputes Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review and resolve disputes for sales and swaps.
            </p>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value || "")}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          >
            <option value="open">Open only</option>
            <option value="">All statuses</option>
            <option value="resolved_refunded">Resolved – Refunded</option>
            <option value="resolved_rejected">Resolved – Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <p className="text-gray-500 dark:text-gray-300">Loading disputes...</p>
          </div>
        ) : disputes.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-gray-500 dark:text-gray-300">
              No disputes found for this filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Deal</th>
                  <th className="px-3 py-2 text-left">Opened By</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/70"
                  >
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                      #{d.id}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                      <div className="flex flex-col">
                        <span className="font-medium uppercase text-xs">
                          {d.deal_type}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Deal ID: {d.deal_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                      <div className="flex flex-col">
                        <span className="text-xs">
                          User #{d.opened_by} ({d.opened_by_role})
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                      <span className="text-xs capitalize">
                        {d.reason_code.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          d.status === "open"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                            : d.status === "resolved_refunded"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                            : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/admin/disputes/${d.id}`}
                        className="inline-flex px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Open Case
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDisputes;
