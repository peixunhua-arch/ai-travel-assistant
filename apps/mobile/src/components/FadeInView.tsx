// §9 淡入动效：Tab 子页切换、内容区出现时用。
import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle, type StyleProp } from 'react-native';

export function FadeInView({
  children,
  style,
  duration = 280,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(6);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, duration]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
