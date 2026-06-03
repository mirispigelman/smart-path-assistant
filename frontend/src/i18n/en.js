/** English UI strings */
export const en = {
    appName: 'SmartShopper',
    brandBadge: '2026',
    aiPill: 'AI-Powered · 2026 Edition',

    login: {
        title: 'Welcome to',
        subtitle:
            'Plan smarter trips. Our AI maps every item to the right aisle and builds the shortest path through the store.',
        fullName: 'Full name',
        namePlaceholder: 'Jane Cooper',
        email: 'Email',
        emailPlaceholder: 'jane@example.com',
        continue: 'Continue →',
        loading: 'Signing in…',
        foot: 'New here? Just enter your details — your account is created automatically.',
        signInError: 'Could not sign you in. Please try again.',
        networkError: 'Network error. Please try again.',
    },

    nav: {
        primary: 'Primary',
        signOut: 'Sign out',
    },

    hero: {
        pill: 'AI route engine online',
        title: 'Shop in the',
        titleAccent: 'smartest order',
        subtitle:
            'Add items by text, photo, or voice. We map each one to its aisle and plot the shortest walk through the store.',
        step1: 'Build list',
        step2: 'Review items',
        step3: 'Smart route',
    },

    actions: {
        title: 'Build your list',
        subtitle: 'Three fast ways to add items — pick whatever\'s easiest.',
        quickAdd: 'Quick add',
        placeholder: 'e.g. Milk, Bread, Eggs…',
        add: 'Add',
        uploadTitle: 'Upload a list',
        uploadHint:
            'Snap a photo or PDF — items go to your list. Calculate the route when you are ready.',
        uploadLabel: 'Click to upload image or PDF',
        uploadProcessing: 'Processing…',
        uploadAria: 'Upload a shopping list image or PDF',
        voiceTitle: 'Voice input',
        voiceHint: 'Say several items separated by commas, e.g. "milk, eggs, cheese".',
        voiceListening: 'Listening…',
        voiceRecord: 'Record items',
        calculateRoute: 'Calculate shortest route',
        clearList: 'Clear list',
        confirmClear: 'Clear your entire shopping list?',
    },

    list: {
        title: 'Your items',
        collapse: 'Collapse list',
        expand: 'Expand list',
        loading: 'Loading items…',
        empty: 'Your list is empty. Add items above to get started.',
        edit: 'Edit',
        delete: 'Delete',
        editTitle: 'Edit item',
        save: 'Save',
        cancel: 'Cancel',
        confirmDelete: 'Remove this item?',
    },

    route: {
        title: 'Your optimized route',
        subtitle: 'Follow the stops in order — the arrows show the way.',
        directions: 'Directions',
        aisle: 'Aisle',
        shelf: 'Shelf',
        notMapped: 'This product does not exist in the store.',
        atEntrance: 'Right by the entrance.',
        sameAisle: '↔️ Same aisle as the previous item.',
    },

    storeMap: {
        empty: 'Map will appear here once items are mapped to store locations.',
        shelves: 'Shelves',
        aisleFloor: 'Aisle floor',
        crossAisle: 'Cross aisle (rows 0, 3–4)',
        entrance: 'Entrance',
        yourPath: 'Your path',
        pickup: 'Pick up',
        in: 'IN',
        pickUp: 'Pick up',
        crossAisleTitle: 'Cross aisle',
        ariaLabel: (n) =>
            `Store map with ${n} pickup locations along your route from the entrance`,
        hint:
            'Cross-aisle rows 0, 3, and 4 use the same narrow path width as the vertical aisles — forming a clear grid. Hover 🛒 for the product name.',
    },

    toast: {
        itemAdded: (name) => `"${name}" added to your list`,
        addFailed: 'Could not add the item',
        fileAdded: (items) => `Added to list: ${items}`,
        noProductsInFile: 'No products found in the file',
        fileError: 'Error processing file',
        voiceUnsupported: 'Your browser does not support voice recognition',
        voiceAdded: (items) => `Added: ${items}`,
        voiceEmpty: 'No products detected in your recording',
        voiceError: 'Error analyzing your voice input',
        routeReady: 'Shortest route ready!',
        routeEmpty: 'No items yet — add some products first',
        routeError: 'Error calculating the route',
        listCleared: 'List cleared',
        clearError: 'Error clearing the list',
        loadFailed: 'Could not load your list',
        removed: 'Item removed',
        removeFailed: 'Could not remove item',
        updated: 'Item updated',
        updateFailed: 'Could not update item',
        sessionExpired: 'Session expired. Please sign in again.',
        geminiQuota: 'Gemini API limit reached. Please wait and try again.',
    },

    progress: 'Progress',
};

/** API messages are already in English — pass through as-is */
export function translateApiMessage(msg) {
    return msg;
}

export default en;
