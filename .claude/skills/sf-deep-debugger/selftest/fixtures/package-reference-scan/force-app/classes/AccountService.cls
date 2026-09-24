public class AccountService {
    public void doWork() {
        AccountServiceHelper helper = new AccountServiceHelper();
        helper.process();
        List<String> names = new List<String>();
        BaseService.run();
    }
}
