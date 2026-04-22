export type ChartRecipe<TProps extends object, TName extends string = string> = Readonly<{
  name: TName;
  description: string;
  props: Readonly<Partial<TProps>>;
}>;

export function defineChartRecipe<TProps extends object, TName extends string>(
  recipe: ChartRecipe<TProps, TName>,
): ChartRecipe<TProps, TName> {
  return recipe;
}

export function defineChartRecipes<const TRecipes>(recipes: TRecipes): TRecipes {
  return recipes;
}

export function mergeChartRecipeProps<TProps extends object>(
  ...recipes: ReadonlyArray<ChartRecipe<TProps> | undefined>
): Partial<TProps> {
  return recipes.reduce<Partial<TProps>>((merged, recipe) => {
    if (recipe == null) {
      return merged;
    }

    return {
      ...merged,
      ...recipe.props,
    };
  }, {});
}
