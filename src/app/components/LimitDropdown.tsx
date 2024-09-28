import React from 'react';

interface LimitDropdownProps {
  limit: number;
  setLimit: (limit: number) => void;
}

const LimitDropdown: React.FC<LimitDropdownProps> = ({ limit, setLimit }) => {
  const options = [100, 500, 1000, 2000, 5000, 10000, 20000, 50000];

  return (
    <div className="mb-4 flex items-center">
      <span className="mr-2 text-black">Number of Conversations:</span>
      <select
        id="limit-select"
        value={limit}
        onChange={(e) => setLimit(Number(e.target.value))}
        className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.toLocaleString()}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LimitDropdown;