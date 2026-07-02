# MonteAI 

A Research Assistant System leveraging Retrieval-Augmented Generation (RAG) 
This is a capstone project as requirement accroding to the CHED memorandum of Colegio de Montalban.
The project is in collaboration with a digital repository system for thesis and capstone studies published within the institution.

## Backend 
ASP.Net Core Web API

## Frontend 

### Web 
React with Vite 

### Mobile 
React Native with Expo

### Desktop
React Electron with Forge

## Development Setup

#### Prerequisites
- Node.js (Latest LTS)
- pnpm
- Expo Go App


#### Quick Start
```
git clone -b dev <repository-url>
cd MonteAI/apps
pnpm install
```

#### Run apps client

**Web** 
```
cd MonteAI
pnpm dev:web
```

**Mobile**
Ensure that your laptop/pc is connected to the phone

*Connect to your phone*
Step 1. Enable Developer options in your phone by tapping build number several times
Step 2. Enable Wireless Debugging
Step 3. Tap *Pair with device with pairing code*
Step 4. In your terminal enter the following command.

```csharp
cd MonteAI
adb pair 192.168.100.14:34159//<- placeholder only, this value is from the IP address & Port
```
You will be prompted to enter pairing code. Enter the Wi-Fi pairing code
Wait for successful connection. 

On your Terminal, run in the command: 
```
cd MonteAI
pnpm dev:mobile
```
You'll see list of commands
![alt text](image.png)

Press ***a*** to open android.
Wait for the build process 



#### Desktop
```
cd MonteAI
pnpm dev:desktop
```