// §9 新消息气泡 slide-in 动效。
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function SlideInBubble({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(14)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View style={{ transform: [{ translateY }], opacity }}>{children}</Animated.View>
  );
}
