import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 14,
  md: 18,
  lg: 24,
};

export default function VerifiedBadge({ size = 'md' }: VerifiedBadgeProps) {
  const px = SIZES[size];

  return (
    <View style={{ marginLeft: 4 }}>
      <Svg width={px} height={px} viewBox="0 0 24 24" fill="none">
        {/* Red circle with thin white border */}
        <Circle cx="12" cy="12" r="11" fill="#ce2b37" stroke="white" strokeWidth="1" />
        {/* White checkmark - Twitter-style proportions */}
        <Path
          d="M7 12.5L10.5 16L17 9"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
