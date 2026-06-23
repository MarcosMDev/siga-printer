import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen }         from './screens/HomeScreen';
import { DiscoveryScreen }    from './screens/DiscoveryScreen';
import { BoletoPrintScreen }  from './screens/BoletoPrintScreen';
import { ReceiptPrintScreen } from './screens/ReceiptPrintScreen';
import { AdvancedScreen }     from './screens/AdvancedScreen';

export type RootStackParamList = {
  Home:         undefined;
  Discovery:    undefined;
  BoletoPrint:  undefined;
  ReceiptPrint: undefined;
  Advanced:     undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle:     { backgroundColor: '#1a1a2e' },
            headerTintColor: '#e0e0e0',
            headerTitleStyle: { fontWeight: '600' },
          }}
        >
          <Stack.Screen name="Home"         component={HomeScreen}         options={{ title: 'Thermal Printer' }} />
          <Stack.Screen name="Discovery"    component={DiscoveryScreen}    options={{ title: 'Descobrir Impressoras' }} />
          <Stack.Screen name="BoletoPrint"  component={BoletoPrintScreen}  options={{ title: 'Imprimir Boleto' }} />
          <Stack.Screen name="ReceiptPrint" component={ReceiptPrintScreen} options={{ title: 'Imprimir Recibo' }} />
          <Stack.Screen name="Advanced"     component={AdvancedScreen}     options={{ title: 'Avançado' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
