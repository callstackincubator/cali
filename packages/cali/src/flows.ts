/**
 * This flow is used to run the application on the selected platform.
 */
export const runApplicationFlow = {
  agent: 'sequenceAgent',
  input: [
    {
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
          agent: 'reactNativeAgent',
          input: 'Start Metro development server if it is not running',
        },
        {
          agent: 'sequenceAgent',
          input: [
            {
              agent: 'userInputAgent',
              input:
                'Ask user to select one of available platforms, based on provided React Native config in the context',
            },
            {
              agent: 'oneOfAgent',
              input: [
                {
                  agent: 'appleAgent',
                  condition: 'User selected to run application on iOS platform',
                  input: 'Run the application on the iOS platform.',
                },
                {
                  agent: 'androidAgent',
                  condition: 'User selected to run application on Android platform',
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
      agent: 'userInputAgent',
      input: `
        Ask user to choose from available flows.
        
        Here is the list of flows, together with their descriptions:
        - "runApplicationFlow": Run the application on the selected platform.
        
        You must return the name of the flow as a string. 
        Each option should be description of the flow, and the value should be the name of the flow.
      `,
    },
    {
      agent: 'oneOfAgent',
      input: [
        {
          ...runApplicationFlow,
          condition: 'User selected to execute "runApplicationFlow"',
        },
      ],
    },
  ],
}
