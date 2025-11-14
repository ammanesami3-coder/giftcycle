import { Link } from "react-router-dom";
import { useUser } from "../context/UserContext";

const Navbar = () => {
  const { user, logout } = useUser();

  return (
    <nav className="bg-white shadow-md p-4 flex justify-between items-center">
      {/* Logo */}
      <Link to="/" className="text-2xl font-bold text-blue-600">
        GiftCycle
      </Link>

      {/* Links */}
      <div className="flex items-center gap-6">

        {/* Always visible */}
        <Link to="/" className="text-gray-700 hover:text-blue-600">
          Home
        </Link>

        <Link to="/add" className="text-gray-700 hover:text-blue-600">
          Add Gift
        </Link>

        {/* Only for logged-in users */}
        {user && (
          <>
            <Link to="/my-offers" className="text-blue-600 hover:underline">
              My Offers
            </Link>

            <Link to="/offers-received" className="text-green-700 hover:underline">
              Offers Received
            </Link>
          </>
        )}

        {/* If NOT logged-in */}
        {!user && (
          <>
            <Link to="/login" className="text-gray-700 hover:text-blue-600">
              Login
            </Link>
            <Link to="/register" className="text-gray-700 hover:text-green-600">
              Register
            </Link>
          </>
        )}

        {/* If logged-in */}
        {user && (
          <>
            <span className="text-gray-700">Hi, {user.name}</span>
            <button
              onClick={logout}
              className="text-red-600 hover:underline"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
