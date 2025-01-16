/**
 * This flow is used to run the application on the selected platform.
 */
export const runApplicationFlow = {
  agent: 'sequenceAgent',
  input: [
    {
      name: 'checkReactNativeEnvironment',
      agent: 'reactNativeAgent',
      input: `
        Check if we are in the React Native environment and whether everything is set up correctly.
        Return React Native config for the project and ask user to choose platform.
      `,
    },
    {
      agent: 'sequenceAgent',
      input: [
        {
          name: 'startMetroServer',
          agent: 'reactNativeAgent',
          input: 'Start Metro development server if it is not running',
        },
        {
          agent: 'oneOfAgent',
          input: [
            {
              name: 'runApplicationOnIOS',
              agent: 'appleAgent',
              when: 'User selected to run application on iOS platform',
              input: 'Run the application on the iOS platform.',
            },
            {
              name: 'runApplicationOnAndroid',
              agent: 'androidAgent',
              when: 'User selected to run application on Android platform',
              input: 'Run the application on the Android platform.',
            },
          ],
        },
      ],
    },
  ],
}

/**
 * Main application flow (aka loop)
 */
export const mainFlow = {
  agent: 'sequenceAgent',
  input: [
    {
      name: 'askUserToChooseFlow',
      agent: 'userInputAgent',
      input: `
        Greet the user and ask them what they want to do today.
        
        You can choose from the following options:
        - Run the application on the selected platform
        - Exit
      `,
    },
    {
      agent: 'oneOfAgent',
      input: [
        {
          ...runApplicationFlow,
          when: 'User selected to run the application on the selected platform',
        },
        {
          agent: 'processAgent',
          input: 'Exit',
          when: 'User selected to exit',
        },
      ],
    },
  ],
}
