import React from 'react';
import { Trophy, Terminal, CheckSquare, User, Shield } from 'lucide-react';
import { PwaModule } from '../../types';

interface ModuleIconProps {
  name: PwaModule['iconName'] | string;
  className?: string;
  size?: number;
}

export const ModuleIcon: React.FC<ModuleIconProps> = ({ name, className = '', size = 18 }) => {
  switch (name) {
    case 'Trophy':
      return <Trophy className={className} size={size} />;
    case 'Terminal':
      return <Terminal className={className} size={size} />;
    case 'CheckSquare':
      return <CheckSquare className={className} size={size} />;
    case 'User':
      return <User className={className} size={size} />;
    default:
      return <Shield className={className} size={size} />;
  }
};
