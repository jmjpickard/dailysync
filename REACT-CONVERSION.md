# React Conversion for Daily Sync

This document outlines the process and architecture for converting the Daily Sync Electron application to use React with electron-vite.

## Implementation Phases

### Phase 1: Basic Setup

- Configured electron-vite for project building
- Set up Tailwind CSS and PostCSS
- Updated TypeScript configuration
- Integrated Electron Forge for packaging
- Created initial project structure

### Phase 2: Component Structure and IPC Bridge

- Created comprehensive preload script with typed API
- Implemented proper TypeScript definitions
- Built key component hierarchy
- Set up functioning IPC communication

### Phase 3: Layout and Responsive Design

- Organized components into domain-specific directories
- Implemented responsive layout with Tailwind CSS
- Created adaptive UI for different screen sizes
- Established proper component relationships

## Directory Structure

```
src/
├── main/              # Electron main process
│   └── index.ts       # Main entry point
│
├── preload/           # Preload scripts
│   └── index.ts       # Bridge between main and renderer
│
├── renderer/          # React application
│   ├── index.html     # HTML entry point
│   └── src/           # React source code
│       ├── main.tsx   # React entry point
│       ├── App.tsx    # Main application component
│       ├── components/# UI components
│       │   ├── Sidebar/
│       │   ├── EventList/
│       │   ├── DetailPane/
│       │   ├── buttons/
│       │   ├── calendar/
│       │   ├── meeting/
│       │   ├── modals/
│       │   ├── tabs/
│       │   └── ui/
│       ├── styles/    # CSS styles
│       └── utils/     # Utility functions
```

## Architecture

### Data Flow

1. **Electron Main Process** handles system-level operations:
   - Google Calendar authentication
   - File system access
   - Audio recording
   - IPC communication

2. **Preload Script** provides a secure bridge:
   - Exposes main process functionality to renderer
   - Provides typed API for React components
   - Handles IPC messaging

3. **React Application** manages UI and user interaction:
   - Uses React functional components with hooks
   - Maintains state at the App level
   - Passes props down to child components

### Key Components

- **Sidebar**: Navigation, mini-calendar, app settings
- **EventListPane**: Calendar events list with date navigation
- **DetailPane**: Meeting details, recording controls, notes/transcript/summary tabs
- **SettingsModal**: App configuration for accounts, audio, and LLM settings

## State Management

State is currently managed using React's built-in hooks:

- `useState` for local component state
- `useEffect` for side effects and lifecycle management
- `useCallback` for memoized callbacks

If the application grows more complex, consider:
- React Context for shared state
- Redux or Zustand for more complex state management

## Running the Application

```bash
# Development
npm run dev

# Build
npm run build

# Package
npm run package

# Create installers
npm run make
```