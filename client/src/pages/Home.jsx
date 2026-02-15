import React, { useMemo, useState } from "react";
import { CalendarDays, CarFront, MapPin, ShieldCheck, Star, Users } from "lucide-react";

const cars = [
  {
    id: 1,
    name: "Toyota Corolla",
    type: "Economy",
    seats: 5,
    transmission: "Automatic",
    fuel: "Petrol",
    pricePerDay: 38,
    image:
      "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 2,
    name: "Tesla Model 3",
    type: "Electric",
    seats: 5,
    transmission: "Automatic",
    fuel: "Electric",
    pricePerDay: 92,
    image:
      "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 3,
    name: "BMW X5",
    type: "SUV",
    seats: 7,
    transmission: "Automatic",
    fuel: "Diesel",
    pricePerDay: 125,
    image:
      "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 4,
    name: "Ford Mustang",
    type: "Sports",
    seats: 4,
    transmission: "Automatic",
    fuel: "Petrol",
    pricePerDay: 148,
    image:
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 5,
    name: "Mercedes V-Class",
    type: "Van",
    seats: 8,
    transmission: "Automatic",
    fuel: "Diesel",
    pricePerDay: 155,
    image:
      "https://images.unsplash.com/photo-1616789916185-d2f858dc82bd?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 6,
    name: "Jeep Wrangler",
    type: "Off-road",
    seats: 5,
    transmission: "Automatic",
    fuel: "Petrol",
    pricePerDay: 110,
    image:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80",
  },
];

const Home = () => {
  const [location, setLocation] = useState("");
  const [carType, setCarType] = useState("All");
  const [sortBy, setSortBy] = useState("popular");

  const filteredCars = useMemo(() => {
    let result = [...cars];

    if (carType !== "All") {
      result = result.filter((car) => car.type === carType);
    }

    if (sortBy === "priceLow") {
      result.sort((a, b) => a.pricePerDay - b.pricePerDay);
    } else if (sortBy === "priceHigh") {
      result.sort((a, b) => b.pricePerDay - a.pricePerDay);
    }

    if (location.trim()) {
      const query = location.toLowerCase();
      result = result.filter((car) =>
        [car.name, car.type, car.fuel].some((field) => field.toLowerCase().includes(query))
      );
    }

    return result;
  }, [carType, location, sortBy]);

  const types = ["All", ...new Set(cars.map((car) => car.type))];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 dark:text-white">
      <section className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-800 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto grid gap-10 md:grid-cols-2 items-center">
          <div>
            <p className="uppercase tracking-[0.2em] text-blue-200 text-sm mb-2">Drive your trip</p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">Rent your perfect car in minutes</h1>
            <p className="mt-4 text-blue-100 max-w-xl">
              Compare top-rated vehicles, transparent prices, and flexible pick-up options for city rides,
              business travel, and family vacations.
            </p>
            <div className="mt-8 grid sm:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-2xl font-bold">20K+</p>
                <p className="text-blue-100">Bookings</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-2xl font-bold">500+</p>
                <p className="text-blue-100">Cars available</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-2xl font-bold">4.9/5</p>
                <p className="text-blue-100">Customer rating</p>
              </div>
            </div>
          </div>

          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-6">
            <h2 className="font-semibold text-lg mb-4">Find available cars</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm text-gray-600">Pick-up location or keyword</span>
                <div className="mt-1 flex items-center border rounded-lg px-3 py-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Dubai, SUV, Electric"
                    className="w-full ml-2 outline-none"
                  />
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-600">Start date</span>
                  <div className="mt-1 flex items-center border rounded-lg px-3 py-2">
                    <CalendarDays className="w-4 h-4 text-gray-500" />
                    <input type="date" className="ml-2 w-full outline-none" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">End date</span>
                  <div className="mt-1 flex items-center border rounded-lg px-3 py-2">
                    <CalendarDays className="w-4 h-4 text-gray-500" />
                    <input type="date" className="ml-2 w-full outline-none" />
                  </div>
                </label>
              </div>

              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition">
                Search Cars
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Popular rental vehicles</h2>
            <p className="text-gray-500 dark:text-gray-300">Choose from trusted economy, luxury, and SUV cars.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={carType}
              onChange={(e) => setCarType(e.target.value)}
              className="border rounded-lg px-3 py-2 dark:bg-gray-800"
            >
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border rounded-lg px-3 py-2 dark:bg-gray-800"
            >
              <option value="popular">Most Popular</option>
              <option value="priceLow">Price: Low to High</option>
              <option value="priceHigh">Price: High to Low</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCars.map((car) => (
            <article
              key={car.id}
              className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow hover:shadow-lg transition"
            >
              <img src={car.image} alt={car.name} className="h-52 w-full object-cover" />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{car.name}</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{car.type}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 text-xs text-gray-500 dark:text-gray-300 gap-2">
                  <p>{car.seats} seats</p>
                  <p>{car.transmission}</p>
                  <p>{car.fuel}</p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <p>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">${car.pricePerDay}</span>
                    <span className="text-gray-500 text-sm"> / day</span>
                  </p>
                  <button className="bg-slate-900 hover:bg-black text-white text-sm px-4 py-2 rounded-lg transition">
                    Book now
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 border-y dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-gray-900">
            <ShieldCheck className="w-7 h-7 text-green-600 mb-3" />
            <h3 className="font-semibold">Fully insured rentals</h3>
            <p className="text-sm mt-2 text-gray-600 dark:text-gray-300">Every booking includes basic insurance and 24/7 roadside support.</p>
          </div>
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-gray-900">
            <CarFront className="w-7 h-7 text-blue-600 mb-3" />
            <h3 className="font-semibold">Clean, ready-to-drive cars</h3>
            <p className="text-sm mt-2 text-gray-600 dark:text-gray-300">Our fleet is inspected after each return for your comfort and safety.</p>
          </div>
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-gray-900">
            <Users className="w-7 h-7 text-purple-600 mb-3" />
            <h3 className="font-semibold">Trusted by travelers</h3>
            <p className="text-sm mt-2 text-gray-600 dark:text-gray-300">Thousands of verified reviews and repeat customers every month.</p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-14 text-center">
        <div className="inline-flex items-center gap-2 text-amber-500 mb-3">
          <Star className="w-4 h-4 fill-amber-500" />
          <Star className="w-4 h-4 fill-amber-500" />
          <Star className="w-4 h-4 fill-amber-500" />
          <Star className="w-4 h-4 fill-amber-500" />
          <Star className="w-4 h-4 fill-amber-500" />
        </div>
        <p className="text-lg md:text-xl max-w-3xl mx-auto text-slate-700 dark:text-gray-200">
          “Best rental experience we had in years. Booking was simple, the car was spotless, and support was
          very responsive.”
        </p>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">— Salma R., frequent business traveler</p>
      </section>
    </div>
  );
};

export default Home;
