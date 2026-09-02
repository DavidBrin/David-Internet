public interface DemoArray<E extends Comparable<E>>{
    
    /* Get the smallest element in the array*/
    public E min();
  
    /* Get the ith element in the array*/
    public E get(int i);

}