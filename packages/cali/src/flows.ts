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
        Return React Native config for the project
      `,
    },
    {
      agent: 'parallelAgent',
      input: [
        {
          name: 'startMetroServer',
          agent: 'reactNativeAgent',
          input: 'Start Metro development server if it is not running',
        },
        {
          agent: 'sequenceAgent',
          input: [
            {
              name: 'askUserToChoosePlatform',
              agent: 'userInputAgent',
              input:
                'Ask user to select one of available platforms, based on provided React Native config in the context',
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
        Ask user to choose from available flows.
        
        Here is the list of flows, together with their descriptions:
        - "runApplicationFlow": Run the application on the selected platform.
        
        You must present options to the user with description of the flow as label, name of the flow as value.
        You must return the name of the flow as a string. 
      `,
    },
    {
      name: 'executeFlow',
      agent: 'oneOfAgent',
      input: [
        {
          ...runApplicationFlow,
          when: 'User selected to execute "runApplicationFlow"',
        },
      ],
    },
  ],
}
