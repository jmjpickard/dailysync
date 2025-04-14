import React from 'react';
import DateNavigator from './DateNavigator';
import AuthButton from './AuthButton';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm p-4 flex items-center justify-between border-b border-gray-200">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold text-gray-800">Daily Sync</h1>
        <DateNavigator />
      </div>
      <AuthButton />
    </header>
  );
};

export default Header;