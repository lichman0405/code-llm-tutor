# Product Requirements Document (PRD)
# LLM-Driven Adaptive Algorithm Learning Platform

**Version**: 1.0  
**Creation Date**: 2024-11-04  
**Product Name**: CodeTutor (Tentative)

---

## 1. Product Overview

### 1.1 Product Positioning
CodeTutor is an intelligent algorithm learning platform driven by Large Language Models (LLMs), providing personalized algorithm learning experiences through adaptive difficulty adjustment and intelligent hint systems.

### 1.2 Target Users
- Algorithm beginners who want systematic learning of data structures and algorithms
- Job seekers preparing for technical interviews
- Developers who want to improve their algorithm skills
- Programming enthusiasts interested in algorithms

### 1.3 Core Value
- **Dynamic Problem Generation**: Not dependent on fixed problem banks, LLMs generate problems and test cases in real-time
- **Adaptive Difficulty**: Dynamically adjust problem difficulty based on user performance
- **Intelligent Assistance**: Provide graded hint systems to guide users step by step
- **Personalized Learning**: Understand user starting points through Warm-up conversations and customize learning paths

---

## 2. User Stories

### 2.1 New User First Use
```
As an algorithm beginner
I want the system to understand my level through simple conversation
So that I can start learning at a suitable difficulty
```

**Process**:
1. User registers and logs in
2. System guides to Warm-up conversation
3. LLM understands through 3-5 rounds of conversation:
   - User's understanding of data structures (arrays, linked lists, trees, etc.)
   - User's learning goals (interview preparation/interest learning/competition training)
   - User's programming background
4. System determines user's starting difficulty level
5. Generate first simple problem

### 2.2 User Problem Solving Process
```
As a learner
I want to get progressive hints when I encounter difficulties
So that I can complete problems independently with guidance
```

**Process**:
1. User sees recommended problems on Dashboard
2. Click to enter problem page, view problem description
3. Write code in code editor
4. If encounter difficulties, click "Need Hint" button:
   - Level 1: Idea direction hint
   - Level 2: Algorithm framework hint
   - Level 3: Pseudocode hint
   - Level 4: Code snippet hint
5. After completion, click "Submit" button
6. System executes code and shows test results
7. Get score and feedback based on results

### 2.3 Adaptive Difficulty
```
As the system
I need to adjust problem difficulty based on user performance
To maintain appropriate challenge
```

**Rules**:
- Consecutive normal completion of 3 problems → Difficulty increases by 1 level
- Consecutive failure or abandonment of 2 problems → Difficulty decreases by 1 level
- Difficulty range: 1-10 levels

---

## 3. Core Function Modules

### 3.1 User Authentication System
- **Registration**: Email/Username + Password
- **Login**: Support remember login status
- **Password Reset**: Email verification

### 3.2 Warm-up Conversation System
**Goal**: Understand user's algorithm foundation and learning goals

**Conversation Content Example**:
```
Bot: Hello! Let me understand your algorithm foundation. How well do you understand data structures (like arrays, linked lists, trees)?
User: I understand arrays and linked lists, but not very familiar with trees

Bot: Good! Have you solved algorithm problems before? About how many?
User: Done about 20 simple problems

Bot: What is your main goal for learning algorithms?
User: Prepare for technical interviews

Bot: Understood! I'll start with medium-easy problems and gradually increase. Ready to begin?
```

**Output**: 
- User's starting difficulty level (e.g.: Level 3)
- User's weak knowledge point tags (e.g.: [Tree, Graph])
- Learning goal type (e.g.: Interview preparation)

### 3.3 Problem Generation System

#### 3.3.1 Generation Strategy
- **Hybrid Mode**:
  - First generation: LLM generates new problems in real-time
  - Subsequent reuse: Select problems of same difficulty/type from database
  - Each user sees different problem order

#### 3.3.2 Problem Structure
```json
{
  "id": "uuid",
  "title": "Two Sum",
  "description": "Given an integer array and target value, find two numbers that sum to the target value...",
  "difficulty": 3,
  "algorithm_types": ["Array", "Hash Table"],
  "time_limit": 2000,
  "memory_limit": 256,
  "expected_complexity": "O(n)",
  "examples": [
    {
      "input": "[2,7,11,15], target=9",
      "output": "[0,1]",
      "explanation": "Because nums[0] + nums[1] == 9"
    }
  ],
  "test_cases": [
    {"input": "...", "output": "...", "type": "basic"},
    {"input": "...", "output": "...", "type": "edge"},
    {"input": "...", "output": "...", "type": "performance"}
  ],
  "standard_solution": "def twoSum(nums, target): ...",
  "created_at": "2024-11-04",
  "generated_by": "gpt-4"
}
```

#### 3.3.3 Quality Assurance
- LLM must include when generating problems:
  - At least 3 basic test cases
  - At least 2 edge test cases
  - At least 1 performance test case
- System verifies standard answer passes all test cases
- Optional: Manual review queue

### 3.4 Intelligent Hint System

#### 3.4.1 Hint Grading
| Level | Name | Content Type | Deduction Ratio |
|------|------|----------|----------|
| Level 1 | Idea Hint | Algorithm direction, data structure suggestions, complexity goals | -5% |
| Level 2 | Framework Hint | Algorithm steps, key logic | -15% |
| Level 3 | Pseudocode | Detailed step pseudocode | -30% |
| Level 4 | Code Snippet | Key part implementation code | -50% |

#### 3.4.2 Trigger Method
- User clicks "Need Hint" button
- Must view level by level (see Level 1 before requesting Level 2)
- Each level hint generated by LLM based on:
  - Problem content
  - User's current code
  - Hint level
  Real-time generation

#### 3.4.3 Hint Examples
**Problem**: Reverse Linked List

**Level 1**:
```
Thinking Direction:
- You need to change the pointing relationships of linked list nodes
- Consider using iteration or recursion?
- Time complexity goal: O(n), Space complexity: O(1)
```

**Level 2**:
```
Algorithm Framework:
1. Prepare three pointers: prev, curr, next
2. Traverse linked list, reverse pointing one by one
3. Pay attention to handling head node
```

**Level 3**:
```
Pseudocode:
Initialize prev = None, curr = head
while curr is not empty:
    Save next = curr.next
    Reverse curr.next = prev
    Move prev = curr
    Move curr = next
Return prev
```

**Level 4**:
```python
# Core code snippet
prev = None
curr = head
while curr:
    next_node = curr.next  # Save next node
    curr.next = prev       # Reverse pointing
    # ... you complete the rest
```

### 3.5 Code Submission and Execution

#### 3.5.1 Submission Process
1. User clicks "Submit" button
2. Frontend sends code to backend
3. Backend calls Code Executor
4. Execute all test cases
5. Return results:
   ```json
   {
     "status": "success",
     "passed": 15,
     "total": 15,
     "execution_time": 45,
     "memory_used": 12.5,
     "test_results": [
       {"case": 1, "passed": true, "time": 3},
       {"case": 2, "passed": true, "time": 2},
       ...
     ]
   }
   ```

#### 3.5.2 Supported Languages
- Python 3.11+
- JavaScript (Node.js 18+)
- Java 17+
- C++ 17+
- Go 1.21+

### 3.6 Scoring System

#### 3.6.1 Scoring Formula
```
Base Score = 100

Final Score = Base Score 
  × Accuracy Coefficient 
  × Time Coefficient 
  × Hint Penalty Coefficient 
  × Code Quality Coefficient
```

#### 3.6.2 Coefficient Calculations

**Accuracy Coefficient**:
- Pass all test cases: 1.0
- Pass 80%-99%: 0.7
- Pass 50%-79%: 0.4
- Pass < 50%: 0

**Time Coefficient**:
```
Time Ratio = Actual Time / Expected Time
- Time Ratio < 0.5: 1.2 (fast completion bonus)
- Time Ratio 0.5-1.0: 1.0
- Time Ratio 1.0-2.0: 0.9
- Time Ratio > 2.0: 0.7
```

**Hint Penalty Coefficient**:
- No hints used: 1.0
- Used Level 1: 0.95
- Used Level 2: 0.85
- Used Level 3: 0.70
- Used Level 4: 0.50

**Code Quality Coefficient**:
- Complexity meets expectation: 1.0
- Complexity one level higher (e.g., expect O(n) but implement O(n²)): 0.8
- Complexity two levels or more higher: 0.6

#### 3.6.3 Example Calculation
```
User completes a problem:
- Pass all test cases (Accuracy = 1.0)
- Time 5 minutes, expected 10 minutes (Time = 1.0)
- Used Level 2 hint (Hint = 0.85)
- Complexity meets expectation (Quality = 1.0)

Final Score = 100 × 1.0 × 1.0 × 0.85 × 1.0 = 85 points
```

### 3.7 Adaptive Difficulty System

#### 3.7.1 Difficulty Level Definition
| Level | Description | Corresponding Algorithm Type Examples |
|------|------|------------------|
| 1-2 | Beginner | Simple array operations, basic loops |
| 3-4 | Easy | Two pointers, simple hash tables |
| 5-6 | Medium | Recursion, basic dynamic programming, BFS/DFS |
| 7-8 | Medium-Hard | Complex dynamic programming, graph algorithms |
| 9-10 | Hard | Advanced algorithms, complex optimizations |

#### 3.7.2 Adjustment Rules
**Trigger Conditions**:
- Evaluate after completing each problem
- Statistics on recent 5 problems' performance

**Increase Difficulty** (meet any condition):
- Consecutive 3 problems score ≥ 80
- Recent 5 problems average ≥ 85

**Decrease Difficulty** (meet any condition):
- Consecutive 2 problems score < 50
- Consecutive 2 problems abandoned (not submitted)
- Recent 5 problems average < 40

**Difficulty Change**:
- Increase: Current difficulty + 1 (max 10)
- Decrease: Current difficulty - 1 (min 1)

#### 3.7.3 User Ability Profile
System maintains for each user:
```json
{
  "user_id": "uuid",
  "current_level": 5,
  "algorithm_proficiency": {
    "Array": 6,
    "Linked List": 4,
    "Tree": 3,
    "Graph": 2,
    "Dynamic Programming": 3,
    "Sorting": 7
  },
  "learning_velocity": 1.2,  // Learning speed coefficient
  "recent_performance": [85, 90, 78, 92, 88]  // Recent 5 problem scores
}
```

### 3.8 History System

#### 3.8.1 Record Content
Save each submission:
- Submission time
- Problem ID
- User code
- Execution result
- Score
- Hint level used
- Time used

#### 3.8.2 Display Dimensions
- **Timeline View**: Show all submissions in reverse chronological order
- **Problem Category View**: Group by algorithm type
- **Progress Statistics**: 
  - Total problems completed
  - Completion count by difficulty
  - Average score
  - Growth curve chart

---

## 4. LLM Integration Requirements

### 4.1 Supported LLM Providers
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3)
- Other services compatible with OpenAI API format

### 4.2 LLM Call Scenarios

| Scenario | Call Purpose | Input | Output |
|------|----------|------|------|
| Warm-up Conversation | Assess user level | Conversation history | Next question / Assessment result |
| Problem Generation | Generate new problems | Difficulty level, algorithm type | Complete problem structure |
| Intelligent Hints | Generate graded hints | Problem, user code, hint level | Hint content |
| Code Analysis | Evaluate code quality | User code, problem | Complexity analysis |

### 4.3 Configuration Management
- Users can configure in system settings:
  - Select LLM Provider
  - Fill API Key
  - Select model version
- Administrators can configure default LLM (for users without configuration)

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements
- Code execution response time < 5 seconds
- LLM hint generation response time < 3 seconds
- Page load time < 2 seconds

### 5.2 Security Requirements
- User passwords encrypted storage (bcrypt)
- API Key encrypted storage
- Code execution sandbox isolation
- Prevent malicious code execution

### 5.3 Availability Requirements
- System availability > 99%
- Support concurrent users > 1000

---

## 6. Feature Priorities

### P0 (Must Have - MVP)
- [x] User registration/login
- [x] Warm-up conversation system
- [x] Problem generation system (basic version)
- [x] Code editor
- [x] Code execution and testing
- [x] Basic scoring system
- [x] Adaptive difficulty

### P1 (Important - Second Phase)
- [ ] Intelligent hint system
- [ ] History record viewing
- [ ] User ability profile
- [ ] Learning progress visualization

### P2 (Optimization - Third Phase)
- [ ] Problem bookmarking feature
- [ ] Code sharing feature
- [ ] Community discussion
- [ ] Learning path recommendation

---

## 7. Future Iteration Directions

- Support more programming languages
- Add algorithm visualization
- Multiplayer battle mode
- Study group features
- Mobile adaptation

---

**Document Status**: ✅ Completed  
**Reviewer**: TBD  
**Last Updated**: 2024-11-04
