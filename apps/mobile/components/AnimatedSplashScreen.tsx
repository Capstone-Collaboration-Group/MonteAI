import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import Animated, { 
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    Easing,
} from 'react-native-reanimated';
// import { useTheme } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const LOGO_SIZE = 128;
const MARGIN_MOBILE = 16;
const TEXT_GAP = 24;

const AVAILABLE_WIDTH = width - MARGIN_MOBILE * 2;
const CENTER_OFFSET = (AVAILABLE_WIDTH - LOGO_SIZE) /2;

interface Props { 
    onGetStarted?: () => void;
}

export default function AnimatedSplashScreen( { onGetStarted } : Props ) { 
    const logoScale = useSharedValue(0.6);
    const logoOpacity = useSharedValue(0);
    const logoTranslateX = useSharedValue(CENTER_OFFSET); 

    const textOpacity = useSharedValue(0);
    const textTranslateX = useSharedValue(-10);

    const dot1 = useSharedValue(0.2);
    const dot2 = useSharedValue(0.2);
    const dot3 = useSharedValue(0.2);

    const dotsRowOpacity = useSharedValue(1);

    const buttonOpacity = useSharedValue(0);
    const buttonTranslateY = useSharedValue(8);

    const [buttonReady, setButtonReady] = useState(false);

    //colors 
    const backgroundColor = useThemeColor({}, 'background');
    const primaryColor = useThemeColor({}, 'primary');
    const onPrimaryColor = useThemeColor({}, 'onPrimary');

    useEffect(() => { 
        // 1
        logoScale.value = withTiming(1, { 
            duration: 800,
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        });
        logoOpacity.value = withTiming(1, { 
            duration: 800,
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        });
        
        // 2
        logoTranslateX.value = withDelay(
            1500,
            withTiming(0, { 
                duration: 1000, easing: Easing.bezier(0.65, 0, 0.35, 1) })
        );
        
        // 3
        textOpacity.value = withDelay(
            1700,
            withTiming(1, {duration: 1000, easing: Easing.bezier(0.65, 0, 0.35, 1) })
        );
        textTranslateX.value = withDelay(
            1700, 
            withTiming(0, {duration: 1000, easing: Easing.bezier(0.65, 0, 0.35, 1)})
        );
        
        // 4
        const pulse = () => 
            withRepeat(
                withSequence(
                    withTiming(0.6, {duration: 1000, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0.2, {duration: 1000, easing: Easing.inOut(Easing.ease )})
                ),
                -1,
                false
            );
            dot1.value = pulse();
            dot2.value = withDelay(200, pulse());
            dot3.value = withDelay(400, pulse());
            
            // 5
            dotsRowOpacity.value = withDelay(2500, withTiming(0, { duration: 300 }));
            buttonOpacity.value = withDelay(2700, withTiming(1, { duration: 400 }));
            buttonTranslateY.value = withDelay(
                2700,
                withTiming(0, {duration: 400, easing: Easing.out(Easing.cubic) })
            );

            const readyTimer = setTimeout(() => setButtonReady(true), 2700);
            return () => clearTimeout(readyTimer);
    }, []);

    const logoStyle = useAnimatedStyle(() => ({
        opacity: logoOpacity.value,
        transform: [
            {scale: logoScale.value }, 
            { translateX: logoTranslateX.value },
        ],
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateX: textTranslateX.value }],
    }));

    const dot1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
    const dot2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
    const dot3Style = useAnimatedStyle(() => ({ opacity: dot3.value }));
    const dotsRowStyle = useAnimatedStyle(() => ({ opacity: dotsRowOpacity.value }))

    const buttonStyle = useAnimatedStyle(() => ({
        opacity: buttonOpacity.value,
        transform: [{ translateY: buttonTranslateY.value}],
    }));

    return (
  <View style={[styles.container, { backgroundColor }]}>
    <View style={styles.row}>
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image
          source={require('../assets/images/cdm-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View style={[styles.textWrap, textStyle]}>
        <Text style={[styles.title, { color: primaryColor }]}>MonteScholar</Text>
      </Animated.View>
    </View>

    <Animated.View
      pointerEvents="none"
      style={[styles.dotsRow, dotsRowStyle]}
    >
      <Animated.View style={[styles.dot, { backgroundColor: primaryColor }, dot1Style]} />
      <Animated.View style={[styles.dot, { backgroundColor: primaryColor }, dot2Style]} />
      <Animated.View style={[styles.dot, { backgroundColor: primaryColor }, dot3Style]} />
    </Animated.View>

    <Animated.View style={[styles.buttonWrap, buttonStyle]}>
      <Pressable
        disabled={!buttonReady}
        onPress={onGetStarted}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: primaryColor },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={[styles.buttonText, { color: onPrimaryColor }]}>Get Started</Text>
      </Pressable>
    </Animated.View>
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: MARGIN_MOBILE,
    minHeight: 160,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  textWrap: {
    marginLeft: TEXT_GAP,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 56,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  buttonWrap: {
    position: 'absolute',
    bottom: 48,
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});