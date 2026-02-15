/**
 * ステップ表示コンポーネント
 * Phase 45: AIシフト生成進行状況表示機能
 */

import type { StepDefinition } from './types';

interface ProgressStepsProps {
  currentStep: number;
  steps: StepDefinition[];
  isCompleted: boolean;
}

/**
 * チェックマークアイコン
 */
function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-white"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/**
 * ステップ番号またはアイコンを表示
 */
function StepIndicator({
  step,
  currentStep,
  isCompleted,
}: {
  step: StepDefinition;
  currentStep: number;
  isCompleted: boolean;
}) {
  const isActive = step.id === currentStep && !isCompleted;
  const isPast = step.id < currentStep || isCompleted;

  if (isPast) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 transition-colors duration-300">
        <CheckIcon />
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white font-medium transition-colors duration-300">
        <span className="animate-pulse">{step.id}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-500 font-medium transition-colors duration-300">
      {step.id}
    </div>
  );
}

/**
 * ステップ表示コンポーネント
 * 5つの処理ステップを縦に並べて表示し、現在のステップをハイライト表示する
 */
export function ProgressSteps({ currentStep, steps, isCompleted }: ProgressStepsProps) {
  return (
    <div className="space-y-4" role="list" aria-label="処理ステップ">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep && !isCompleted;
        const isPast = step.id < currentStep || isCompleted;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="relative" role="listitem">
            <div className="flex items-start">
              {/* ステップインジケーター */}
              <div className="shrink-0">
                <StepIndicator
                  step={step}
                  currentStep={currentStep}
                  isCompleted={isCompleted}
                />
              </div>

              {/* ステップ内容 */}
              <div className="ml-4 min-w-0 flex-1">
                <p
                  className={`text-sm font-medium transition-colors duration-300 ${
                    isActive
                      ? 'text-indigo-600'
                      : isPast
                        ? 'text-green-600'
                        : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </p>
                <p
                  className={`text-sm transition-colors duration-300 ${
                    isActive ? 'text-gray-600' : 'text-gray-400'
                  } hidden sm:block`}
                >
                  {step.description}
                </p>
              </div>
            </div>

            {/* 接続線 */}
            {!isLast && (
              <div
                className={`absolute left-4 top-8 -ml-px h-6 w-0.5 transition-colors duration-300 ${
                  isPast ? 'bg-green-500' : 'bg-gray-200'
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
